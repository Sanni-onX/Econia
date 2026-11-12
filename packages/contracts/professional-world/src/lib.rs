//! Professional NFT identities and protected, explicitly authorized native NEAR escrow.
use near_contract_standards::non_fungible_token::{
    approval::NonFungibleTokenApproval,
    core::{NonFungibleTokenCore, NonFungibleTokenResolver},
    enumeration::NonFungibleTokenEnumeration,
    metadata::{
        NFTContractMetadata, NonFungibleTokenMetadataProvider, TokenMetadata, NFT_METADATA_SPEC,
    },
    NonFungibleToken, Token, TokenId,
};
use near_sdk::{
    assert_one_yocto, collections::LookupMap, env, ext_contract, json_types::U128, near, require,
    AccountId, NearToken, PanicOnDefault, Promise, PromiseError, PromiseOrValue,
};
use std::collections::HashMap;

#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Professional {
    pub profession: String,
    pub services: Vec<String>,
    pub provenance: String,
    pub treasury: U128,
    pub paused: bool,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct BudgetPolicy {
    pub owner: AccountId,
    pub remaining: U128,
    pub per_job: U128,
    pub allowed_services: Vec<String>,
    pub auto_accept: bool,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Allocation {
    pub agent_id: String,
    pub service_id: String,
    pub amount: U128,
    pub parent_index: Option<u8>,
    pub evidence: Option<String>,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct ServiceJob {
    pub proposal_id: String,
    pub customer: AccountId,
    pub buyer_agent: Option<String>,
    pub scope_hash: String,
    pub allocations: Vec<Allocation>,
    pub total: U128,
    pub deadline: u64,
    pub state: String,
}
// Exact Borsh layout of the deployed native-world v1. Never use the new layout
// to decode an old state, or reuse its agent-value prefix for Professionals.
#[near(serializers=[borsh])]
#[cfg(feature = "native-migration")]
pub struct LegacyAgent {
    treasury: U128,
    capital_received: U128,
    paused: bool,
    provenance: String,
}
#[near(serializers=[borsh])]
#[cfg(feature = "native-migration")]
pub struct LegacyJob {
    customer: AccountId,
    agent_id: String,
    payment: U128,
    deadline: u64,
    delivered: bool,
    evidence: Option<String>,
}
#[near(serializers=[borsh])]
#[cfg(feature = "native-migration")]
pub struct LegacyWorld {
    owner: AccountId,
    operator: AccountId,
    tokens: NonFungibleToken,
    agents: LookupMap<String, LegacyAgent>,
    jobs: LookupMap<u64, LegacyJob>,
    refunds: LookupMap<AccountId, u128>,
    next_job: u64,
    treasury_total: u128,
    job_total: u128,
    refund_total: u128,
    last_batch: u64,
    paused: bool,
}
#[near(serializers=[json])]
#[cfg(feature = "native-migration")]
pub struct GenesisProfile {
    pub agent_id: String,
    pub name: String,
    pub profession: String,
    pub services: Vec<String>,
    pub provenance: String,
}
fn network() -> &'static str {
    if env::current_account_id().as_str().ends_with(".testnet") {
        "testnet"
    } else {
        "mainnet"
    }
}
#[ext_contract(ext_self)]
pub trait RefundCallback {
    fn resolve_refund(
        &mut self,
        account: AccountId,
        amount: U128,
        #[callback_result] result: Result<(), PromiseError>,
    );
}
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct ProfessionalWorld {
    owner: AccountId,
    operator: AccountId,
    tokens: NonFungibleToken,
    agents: LookupMap<String, Professional>,
    policies: LookupMap<String, BudgetPolicy>,
    jobs: LookupMap<u64, ServiceJob>,
    proposal_ids: LookupMap<String, u64>,
    refunds: LookupMap<AccountId, u128>,
    next_job: u64,
    treasury_total: u128,
    escrow_total: u128,
    refund_total: u128,
    execution_storage: u128,
}
impl ProfessionalWorld {
    fn admin(&self) {
        require!(env::predecessor_account_id() == self.owner, "Admin only");
    }
    fn operator(&self) {
        require!(
            env::predecessor_account_id() == self.operator,
            "Restricted operator only"
        );
    }
    fn owner_of(&self, id: &String) -> AccountId {
        self.tokens.owner_by_id.get(id).expect("Unknown NFT")
    }
    fn require_owner(&self, id: &String) {
        require!(
            self.owner_of(id) == env::predecessor_account_id(),
            "Current NFT owner only"
        );
    }
    fn backed(&self) {
        let liabilities = self
            .treasury_total
            .checked_add(self.escrow_total)
            .unwrap()
            .checked_add(self.refund_total)
            .unwrap()
            .checked_add(self.execution_storage)
            .unwrap();
        let storage = env::storage_byte_cost()
            .as_yoctonear()
            .checked_mul(u128::from(env::storage_usage()))
            .unwrap();
        require!(
            env::account_balance().as_yoctonear() >= liabilities.checked_add(storage).unwrap(),
            "Custody backing insufficient"
        );
    }
    fn event(&self, kind: &str, data: near_sdk::serde_json::Value) {
        env::log_str(&format!(
            "EVENT_JSON:{}",
            near_sdk::serde_json::json!({"standard":"econia_professionals","version":"1.0.0","event":kind,"data":[data]})
        ));
    }
    fn credit_refund(&mut self, account: &AccountId, amount: u128) {
        if amount > 0 {
            let old = self.refunds.get(account).unwrap_or(0);
            self.refunds
                .insert(account, &old.checked_add(amount).unwrap());
            self.refund_total = self.refund_total.checked_add(amount).unwrap();
        }
    }
    fn validate_allocations(&self, allocations: &Vec<Allocation>) -> u128 {
        require!(
            !allocations.is_empty() && allocations.len() <= 8,
            "1–8 explicit allocations required"
        );
        let mut total = 0u128;
        for (i, a) in allocations.iter().enumerate() {
            let agent = self.agents.get(&a.agent_id).expect("Unknown provider");
            require!(
                !agent.paused && agent.services.contains(&a.service_id),
                "Provider capability unavailable"
            );
            require!(
                a.amount.0 > 0 && a.evidence.is_none(),
                "Positive unfunded allocation required"
            );
            if i == 0 {
                require!(a.parent_index.is_none(), "Prime must be root");
            } else {
                require!(
                    a.parent_index.map(|p| usize::from(p) < i).unwrap_or(false),
                    "Dependency must precede child"
                );
            }
            total = total.checked_add(a.amount.0).unwrap();
        }
        total
    }
    fn insert_job(
        &mut self,
        proposal_id: String,
        scope_hash: String,
        allocations: Vec<Allocation>,
        deadline: u64,
        buyer_agent: Option<String>,
        total: u128,
    ) -> u64 {
        require!(
            proposal_id.len() >= 8
                && proposal_id.len() <= 100
                && self.proposal_ids.get(&proposal_id).is_none(),
            "Unique proposal ID required"
        );
        require!(
            scope_hash.len() == 64 && scope_hash.chars().all(|c| c.is_ascii_hexdigit()),
            "SHA-256 scope commitment required"
        );
        require!(
            deadline > env::block_timestamp()
                && deadline - env::block_timestamp() <= 30 * 24 * 3600 * 1_000_000_000,
            "Deadline bound"
        );
        let before = env::storage_usage();
        let id = self.next_job;
        self.next_job = id.checked_add(1).unwrap();
        let allocation_count = allocations.len();
        let job = ServiceJob {
            proposal_id: proposal_id.clone(),
            customer: env::predecessor_account_id(),
            buyer_agent,
            scope_hash,
            allocations,
            total: U128(total),
            deadline,
            state: "FUNDED".into(),
        };
        self.jobs.insert(&id, &job);
        self.proposal_ids.insert(&proposal_id, &id);
        self.escrow_total = self.escrow_total.checked_add(total).unwrap();
        let reserve = env::storage_byte_cost()
            .as_yoctonear()
            .checked_mul(u128::from(
                env::storage_usage() - before + 1024 + (allocation_count as u64) * 128,
            ))
            .unwrap();
        let attached = env::attached_deposit().as_yoctonear();
        if job.buyer_agent.is_none() {
            require!(
                attached >= total.checked_add(reserve).unwrap(),
                "Attach exact price plus storage reserve"
            );
            self.credit_refund(&env::predecessor_account_id(), attached - total - reserve);
        } else {
            require!(attached == 0, "Restricted operator attaches no funds");
            self.execution_storage = self
                .execution_storage
                .checked_sub(reserve)
                .expect("Platform execution-storage allowance exhausted");
        }
        self.backed();
        self.event("service_job_funded",near_sdk::serde_json::json!({"job_id":id,"proposal_id":proposal_id,"total":total.to_string()}));
        id
    }
}
#[near]
impl ProfessionalWorld {
    #[init]
    pub fn new(owner_id: AccountId, operator_id: AccountId) -> Self {
        Self {
            owner: owner_id.clone(),
            operator: operator_id,
            tokens: NonFungibleToken::new(b"n", owner_id, Some(b"m"), Some(b"o"), Some(b"a")),
            agents: LookupMap::new(b"g"),
            policies: LookupMap::new(b"p"),
            jobs: LookupMap::new(b"j"),
            proposal_ids: LookupMap::new(b"q"),
            refunds: LookupMap::new(b"f"),
            next_job: 0,
            treasury_total: 0,
            escrow_total: 0,
            refund_total: 0,
            execution_storage: 0,
        }
    }
    /// Atomic upgrade only for the paused, unused native-world release. All
    /// NFT ownership, metadata and approvals survive. Old virtual identities
    /// remain transferable but cannot sell services or consume inference.
    #[private]
    #[init(ignore_state)]
    #[cfg(feature = "native-migration")]
    pub fn migrate_native(profiles: Vec<GenesisProfile>, expected_supply: u64) -> Self {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "Private migration only"
        );
        let mut old: LegacyWorld = env::state_read().expect("Legacy native state required");
        require!(
            old.owner == env::current_account_id(),
            "Self-owned legacy release required"
        );
        require!(
            old.paused
                && old.next_job == 0
                && old.treasury_total == 0
                && old.job_total == 0
                && old.refund_total == 0,
            "Paused legacy release with no financial obligations required"
        );
        require!(
            old.tokens.owner_by_id.len() == expected_supply && expected_supply <= 100,
            "Legacy supply mismatch"
        );
        require!(
            !profiles.is_empty() && profiles.len() <= 32,
            "Bounded Genesis profiles required"
        );
        let ids: Vec<String> = old.tokens.owner_by_id.iter().map(|(id, _)| id).collect();
        let mut agents: LookupMap<String, Professional> = LookupMap::new(b"g");
        for id in ids {
            let prior = old.agents.remove(&id).expect("Legacy agent missing");
            require!(
                prior.treasury.0 == 0,
                "Legacy treasury must not be discarded"
            );
            // Release obsolete, unfunded virtual-role records. Their NFTs and
            // approval/metadata collections are kept verbatim, and the release
            // tooling preserves the old records in the hashed backup. An NFT
            // without a Professional record cannot receive capital or sell work.
        }
        let mut seen = std::collections::HashSet::new();
        for p in profiles {
            require!(
                seen.insert(p.agent_id.clone())
                    && !p.agent_id.is_empty()
                    && p.agent_id.len() <= 64
                    && !p.name.is_empty()
                    && p.name.len() <= 100
                    && !p.profession.is_empty()
                    && p.profession.len() <= 100
                    && p.provenance.len() <= 256
                    && !p.services.is_empty()
                    && p.services.len() <= 8
                    && p.services.iter().all(|s| !s.is_empty() && s.len() <= 64),
                "Unique bounded profile required"
            );
            // Existing NFTs cannot be reassigned to other people by migration.
            if let Some(metadata) = old
                .tokens
                .token_metadata_by_id
                .as_ref()
                .and_then(|m| m.get(&p.agent_id))
            {
                let legacy_title = format!(
                    "{} #{}",
                    p.name,
                    p.agent_id.strip_prefix("person_").unwrap_or(&p.agent_id)
                );
                require!(
                    metadata.title.as_deref() == Some(p.name.as_str())
                        || metadata.title.as_deref() == Some(legacy_title.as_str()),
                    "Existing identity name mismatch"
                );
            } else {
                old.tokens.internal_mint_with_refund(p.agent_id.clone(), old.owner.clone(), Some(TokenMetadata { title: Some(p.name), description: Some(format!("{} professional. Treasury follows the NFT; returns are not guaranteed.",p.profession)), reference: Some(p.provenance.clone()), ..Default::default() }), None);
                near_contract_standards::non_fungible_token::events::NftMint {
                    owner_id: &old.owner,
                    token_ids: &[&p.agent_id],
                    memo: Some("Econia professional Genesis; zero starting capital"),
                }
                .emit();
            }
            agents.insert(
                &p.agent_id,
                &Professional {
                    profession: p.profession,
                    services: p.services,
                    provenance: p.provenance,
                    treasury: U128(0),
                    paused: false,
                },
            );
        }
        let world = Self {
            owner: old.owner,
            operator: env::current_account_id(),
            tokens: old.tokens,
            agents,
            policies: LookupMap::new(b"p"),
            jobs: LookupMap::new(b"j"),
            proposal_ids: LookupMap::new(b"q"),
            refunds: old.refunds,
            next_job: 0,
            treasury_total: 0,
            escrow_total: 0,
            refund_total: 0,
            execution_storage: 0,
        };
        // All financial liabilities are zero. Protocol storage backing is
        // enforced on this atomic receipt, after the final smaller code is
        // deployed. Do not require both temporary upgrader code and final code
        // storage at once. The batch ends with assert_custody_backed().
        world.event("native_release_migrated", near_sdk::serde_json::json!({"legacy_nfts_preserved":expected_supply,"professionals":seen.len(),"network":network(),"starting_capital":"0"}));
        world
    }
    pub fn assert_custody_backed(&self) {
        self.backed();
    }
    #[payable]
    pub fn mint_professional(
        &mut self,
        agent_id: String,
        receiver_id: AccountId,
        name: String,
        profession: String,
        services: Vec<String>,
        provenance: String,
    ) -> Token {
        self.admin();
        require!(
            self.agents.get(&agent_id).is_none() && agent_id.len() <= 64 && !agent_id.is_empty(),
            "New bounded identity required"
        );
        require!(
            name.len() <= 100
                && !profession.is_empty()
                && profession.len() <= 100
                && provenance.len() <= 256
                && !services.is_empty()
                && services.len() <= 8
                && services.iter().all(|s| !s.is_empty() && s.len() <= 64),
            "Professional metadata bounds"
        );
        let before = env::storage_usage();
        let token = self.tokens.internal_mint(
            agent_id.clone(),
            receiver_id,
            Some(TokenMetadata {
                title: Some(name),
                description: Some(format!(
                    "{} professional. Fixed Genesis identity; treasury follows the NFT. Returns are not guaranteed.",
                    profession
                )),
                reference: Some(provenance.clone()),
                ..Default::default()
            }),
        );
        self.agents.insert(
            &agent_id,
            &Professional {
                profession,
                services,
                provenance,
                treasury: U128(0),
                paused: false,
            },
        );
        let cost = env::storage_byte_cost().as_yoctonear()
            * u128::from(env::storage_usage() - before + 256);
        require!(
            env::attached_deposit().as_yoctonear() >= cost,
            "Mint storage required"
        );
        self.backed();
        token
    }
    pub fn get_professional(&self, agent_id: String) -> Option<Professional> {
        self.agents.get(&agent_id)
    }
    pub fn get_professionals(&self, agent_ids: Vec<String>) -> HashMap<String, Professional> {
        require!(agent_ids.len() <= 100, "View bound");
        agent_ids
            .into_iter()
            .filter_map(|id| self.agents.get(&id).map(|a| (id, a)))
            .collect()
    }
    pub fn get_service_job(&self, job_id: u64) -> Option<ServiceJob> {
        self.jobs.get(&job_id)
    }
    pub fn job_for_proposal(&self, proposal_id: String) -> Option<u64> {
        self.proposal_ids.get(&proposal_id)
    }
    pub fn get_policy(&self, agent_id: String) -> Option<BudgetPolicy> {
        self.policies
            .get(&agent_id)
            .filter(|p| p.owner == self.owner_of(&agent_id))
    }
    pub fn custody(&self) -> near_sdk::serde_json::Value {
        near_sdk::serde_json::json!({"network":network(),"asset":"NEAR","decimals":24,"treasuries":self.treasury_total.to_string(),"escrow":self.escrow_total.to_string(),"refunds":self.refund_total.to_string(),"execution_storage":self.execution_storage.to_string()})
    }
    #[payable]
    pub fn fund_execution_storage(&mut self) {
        self.admin();
        self.execution_storage = self
            .execution_storage
            .checked_add(env::attached_deposit().as_yoctonear())
            .unwrap();
        self.backed();
    }
    #[payable]
    pub fn provide_capital(&mut self, agent_id: String) {
        self.require_owner(&agent_id);
        let mut a = self.agents.get(&agent_id).unwrap();
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "Positive capital required");
        a.treasury.0 = a.treasury.0.checked_add(amount).unwrap();
        self.treasury_total = self.treasury_total.checked_add(amount).unwrap();
        self.agents.insert(&agent_id, &a);
        self.backed();
        self.event(
            "operating_capital",
            near_sdk::serde_json::json!({"agent_id":agent_id,"amount":amount.to_string()}),
        );
    }
    #[payable]
    pub fn authorize_budget(
        &mut self,
        agent_id: String,
        remaining: U128,
        per_job: U128,
        allowed_services: Vec<String>,
        auto_accept: bool,
    ) {
        assert_one_yocto();
        self.require_owner(&agent_id);
        require!(
            per_job.0 <= remaining.0
                && allowed_services.len() <= 16
                && allowed_services
                    .iter()
                    .all(|s| !s.is_empty() && s.len() <= 64),
            "Budget bounds"
        );
        let a = self.agents.get(&agent_id).unwrap();
        require!(
            remaining.0 <= a.treasury.0,
            "Budget exceeds available treasury"
        );
        self.policies.insert(
            &agent_id,
            &BudgetPolicy {
                owner: env::predecessor_account_id(),
                remaining,
                per_job,
                allowed_services,
                auto_accept,
            },
        );
        self.backed();
    }
    #[payable]
    pub fn set_professional_paused(&mut self, agent_id: String, paused: bool) {
        assert_one_yocto();
        self.require_owner(&agent_id);
        let mut a = self.agents.get(&agent_id).unwrap();
        a.paused = paused;
        self.agents.insert(&agent_id, &a);
    }
    #[payable]
    pub fn post_service_job(
        &mut self,
        proposal_id: String,
        scope_hash: String,
        allocations: Vec<Allocation>,
        deadline: u64,
    ) -> u64 {
        let total = self.validate_allocations(&allocations);
        self.insert_job(proposal_id, scope_hash, allocations, deadline, None, total)
    }
    #[payable]
    pub fn open_agent_service_job(
        &mut self,
        buyer_agent: String,
        expected_owner: AccountId,
        proposal_id: String,
        scope_hash: String,
        allocations: Vec<Allocation>,
        deadline: u64,
    ) -> u64 {
        self.operator();
        let total = self.validate_allocations(&allocations);
        let mut buyer = self.agents.get(&buyer_agent).expect("Unknown buyer");
        require!(!buyer.paused, "Buyer paused");
        let mut policy = self
            .get_policy(buyer_agent.clone())
            .expect("Current owner budget required");
        require!(
            policy.owner == expected_owner,
            "Purchase authority changed after owner transfer"
        );
        require!(
            total <= policy.per_job.0 && total <= policy.remaining.0,
            "Authorized spending cap exceeded"
        );
        require!(
            allocations
                .iter()
                .all(|a| policy.allowed_services.contains(&a.service_id)
                    && a.agent_id != buyer_agent),
            "Unapproved service or self payment"
        );
        buyer.treasury.0 = buyer
            .treasury
            .0
            .checked_sub(total)
            .expect("Insufficient working capital");
        policy.remaining.0 -= total;
        self.treasury_total -= total;
        self.agents.insert(&buyer_agent, &buyer);
        self.policies.insert(&buyer_agent, &policy);
        self.insert_job(
            proposal_id,
            scope_hash,
            allocations,
            deadline,
            Some(buyer_agent),
            total,
        )
    }
    pub fn deliver_service_job(&mut self, job_id: u64, evidence: Vec<String>) {
        self.operator();
        let mut job = self.jobs.get(&job_id).expect("Unknown job");
        require!(
            job.state == "FUNDED"
                && env::block_timestamp() <= job.deadline
                && evidence.len() == job.allocations.len(),
            "Job cannot be delivered"
        );
        for (a, hash) in job.allocations.iter_mut().zip(evidence) {
            require!(
                hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit()),
                "Artifact SHA-256 required"
            );
            a.evidence = Some(hash);
        }
        job.state = "DELIVERED".into();
        self.jobs.insert(&job_id, &job);
        self.backed();
        self.event(
            "service_delivered",
            near_sdk::serde_json::json!({"job_id":job_id}),
        );
    }
    #[payable]
    pub fn accept_service_job(&mut self, job_id: u64, expected_owner: Option<AccountId>) {
        let mut job = self.jobs.get(&job_id).expect("Unknown job");
        require!(
            job.state == "DELIVERED" && job.allocations.iter().all(|a| a.evidence.is_some()),
            "Verified delivery required"
        );
        if let Some(ref buyer) = job.buyer_agent {
            let owner = self.owner_of(buyer);
            let operator_allowed = env::predecessor_account_id() == self.operator
                && self
                    .get_policy(buyer.clone())
                    .map(|p| p.auto_accept)
                    .unwrap_or(false);
            require!(
                env::predecessor_account_id() == owner || operator_allowed,
                "Current buyer owner or approved acceptance operator only"
            );
            if operator_allowed {
                require!(
                    expected_owner.as_ref() == Some(&owner),
                    "Acceptance authority changed after owner transfer"
                );
                require!(
                    env::attached_deposit().as_yoctonear() == 0,
                    "Restricted operator attaches no funds"
                );
            } else {
                assert_one_yocto();
            }
        } else {
            assert_one_yocto();
            require!(
                env::predecessor_account_id() == job.customer,
                "Customer only"
            );
        }
        for allocation in &job.allocations {
            let mut agent = self.agents.get(&allocation.agent_id).unwrap();
            agent.treasury.0 = agent.treasury.0.checked_add(allocation.amount.0).unwrap();
            self.agents.insert(&allocation.agent_id, &agent);
        }
        self.treasury_total = self.treasury_total.checked_add(job.total.0).unwrap();
        self.escrow_total -= job.total.0;
        job.state = "SETTLED".into();
        self.jobs.insert(&job_id, &job);
        self.backed();
        self.event(
            "payment_settled",
            near_sdk::serde_json::json!({"job_id":job_id,"total":job.total}),
        );
    }
    #[payable]
    pub fn refund_expired_service_job(&mut self, job_id: u64) {
        assert_one_yocto();
        let mut job = self.jobs.get(&job_id).expect("Unknown job");
        require!(
            ["FUNDED", "DELIVERED"].contains(&job.state.as_str())
                && env::block_timestamp() > job.deadline,
            "Unsettled expired job required"
        );
        if let Some(ref buyer) = job.buyer_agent {
            self.require_owner(buyer);
            let mut a = self.agents.get(buyer).unwrap();
            a.treasury.0 = a.treasury.0.checked_add(job.total.0).unwrap();
            self.treasury_total = self.treasury_total.checked_add(job.total.0).unwrap();
            self.agents.insert(buyer, &a);
        } else {
            require!(
                env::predecessor_account_id() == job.customer,
                "Customer only"
            );
            self.credit_refund(&job.customer, job.total.0);
        }
        self.escrow_total -= job.total.0;
        job.state = "REFUNDED".into();
        self.jobs.insert(&job_id, &job);
        self.backed();
    }
    pub fn refund_balance(&self, account_id: AccountId) -> U128 {
        U128(self.refunds.get(&account_id).unwrap_or(0))
    }
    #[payable]
    pub fn withdraw_refund(&mut self) -> Promise {
        assert_one_yocto();
        let account = env::predecessor_account_id();
        let amount = self.refunds.remove(&account).unwrap_or(0);
        require!(amount > 0, "No refund");
        self.refund_total -= amount;
        Promise::new(account.clone())
            .transfer(NearToken::from_yoctonear(amount))
            .then(ext_self::ext(env::current_account_id()).resolve_refund(account, U128(amount)))
    }
    #[private]
    pub fn resolve_refund(
        &mut self,
        account: AccountId,
        amount: U128,
        #[callback_result] result: Result<(), PromiseError>,
    ) {
        if result.is_err() {
            self.credit_refund(&account, amount.0);
        }
        self.backed();
    }
}
#[near]
impl NonFungibleTokenCore for ProfessionalWorld {
    #[payable]
    fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        self.tokens
            .nft_transfer(receiver_id, token_id, approval_id, memo);
    }
    #[payable]
    fn nft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<bool> {
        self.tokens
            .nft_transfer_call(receiver_id, token_id, approval_id, memo, msg)
    }
    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id)
    }
}
#[near]
impl NonFungibleTokenResolver for ProfessionalWorld {
    #[private]
    fn nft_resolve_transfer(
        &mut self,
        previous_owner_id: AccountId,
        receiver_id: AccountId,
        token_id: TokenId,
        approved_account_ids: Option<HashMap<AccountId, u64>>,
    ) -> bool {
        self.tokens.nft_resolve_transfer(
            previous_owner_id,
            receiver_id,
            token_id,
            approved_account_ids,
        )
    }
}
#[near]
impl NonFungibleTokenApproval for ProfessionalWorld {
    #[payable]
    fn nft_approve(
        &mut self,
        token_id: TokenId,
        account_id: AccountId,
        msg: Option<String>,
    ) -> Option<Promise> {
        self.tokens.nft_approve(token_id, account_id, msg)
    }
    #[payable]
    fn nft_revoke(&mut self, token_id: TokenId, account_id: AccountId) {
        self.tokens.nft_revoke(token_id, account_id);
    }
    #[payable]
    fn nft_revoke_all(&mut self, token_id: TokenId) {
        self.tokens.nft_revoke_all(token_id);
    }
    fn nft_is_approved(
        &self,
        token_id: TokenId,
        approved_account_id: AccountId,
        approval_id: Option<u64>,
    ) -> bool {
        self.tokens
            .nft_is_approved(token_id, approved_account_id, approval_id)
    }
}
#[near]
impl NonFungibleTokenEnumeration for ProfessionalWorld {
    fn nft_total_supply(&self) -> U128 {
        self.tokens.nft_total_supply()
    }
    fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<Token> {
        self.tokens.nft_tokens(from_index, limit)
    }
    fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        self.tokens.nft_supply_for_owner(account_id)
    }
    fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<Token> {
        self.tokens
            .nft_tokens_for_owner(account_id, from_index, limit)
    }
}
#[near]
impl NonFungibleTokenMetadataProvider for ProfessionalWorld {
    fn nft_metadata(&self) -> NFTContractMetadata {
        NFTContractMetadata {
            spec: NFT_METADATA_SPEC.into(),
            name: "Econia Genesis Professionals".into(),
            symbol: "ECONIA".into(),
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::{test_utils::VMContextBuilder, testing_env};
    const ONE: u128 = 10u128.pow(24);
    fn context(caller: &str, deposit: u128, time: u64) {
        let mut b = VMContextBuilder::new();
        b.current_account_id("econia.testnet".parse().unwrap())
            .predecessor_account_id(caller.parse().unwrap())
            .signer_account_id(caller.parse().unwrap())
            .account_balance(NearToken::from_near(1000))
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(time);
        testing_env!(b.build());
    }
    fn fixture() -> ProfessionalWorld {
        context("admin.testnet", 0, 0);
        let mut w = ProfessionalWorld::new(
            "admin.testnet".parse().unwrap(),
            "operator.testnet".parse().unwrap(),
        );
        for (id, profession, service) in [
            ("mira", "hospitality", "procurement-plan"),
            ("dev", "engineering", "website-build"),
            ("designer", "design", "design-spec"),
        ] {
            context("admin.testnet", ONE, 0);
            w.mint_professional(
                id.into(),
                "alice.testnet".parse().unwrap(),
                id.into(),
                profession.into(),
                vec![service.into()],
                "genesis-2".into(),
            );
        }
        context("admin.testnet", ONE, 0);
        w.fund_execution_storage();
        w
    }
    fn allocation(id: &str, service: &str, amount: u128, parent: Option<u8>) -> Allocation {
        Allocation {
            agent_id: id.into(),
            service_id: service.into(),
            amount: U128(amount),
            parent_index: parent,
            evidence: None,
        }
    }
    fn job(w: &mut ProfessionalWorld) -> u64 {
        context("client.testnet", ONE, 0);
        w.post_service_job(
            "proposal-001".into(),
            "a".repeat(64),
            vec![
                allocation("mira", "procurement-plan", 10, None),
                allocation("dev", "website-build", 30, Some(0)),
                allocation("designer", "design-spec", 10, Some(1)),
            ],
            100,
        )
    }
    #[test]
    fn approved_subcontract_graph_settles_exactly_once_and_conserves_custody() {
        let mut w = fixture();
        let id = job(&mut w);
        assert_eq!(w.escrow_total, 50);
        context("operator.testnet", 0, 1);
        w.deliver_service_job(id, vec!["a".repeat(64), "b".repeat(64), "c".repeat(64)]);
        context("client.testnet", 1, 2);
        w.accept_service_job(id, None);
        assert_eq!(w.escrow_total, 0);
        assert_eq!(w.treasury_total, 50);
        assert_eq!(w.get_professional("mira".into()).unwrap().treasury.0, 10);
        assert_eq!(w.get_professional("dev".into()).unwrap().treasury.0, 30);
        assert_eq!(
            w.get_professional("designer".into()).unwrap().treasury.0,
            10
        );
        assert_eq!(w.get_service_job(id).unwrap().state, "SETTLED");
    }
    #[test]
    #[should_panic(expected = "Customer only")]
    fn operator_cannot_accept_customer_work() {
        let mut w = fixture();
        let id = job(&mut w);
        context("operator.testnet", 0, 1);
        w.deliver_service_job(id, vec!["a".repeat(64); 3]);
        context("operator.testnet", 1, 2);
        w.accept_service_job(id, None);
    }
    #[test]
    #[should_panic(expected = "Verified delivery required")]
    fn duplicate_settlement_rejected() {
        let mut w = fixture();
        let id = job(&mut w);
        context("operator.testnet", 0, 1);
        w.deliver_service_job(id, vec!["a".repeat(64); 3]);
        context("client.testnet", 1, 2);
        w.accept_service_job(id, None);
        w.accept_service_job(id, None);
    }
    #[test]
    #[should_panic(expected = "Provider capability unavailable")]
    fn profession_cannot_be_overridden_by_a_contract() {
        let mut w = fixture();
        context("client.testnet", ONE, 0);
        w.post_service_job(
            "proposal-001".into(),
            "a".repeat(64),
            vec![allocation("dev", "procurement-plan", 10, None)],
            100,
        );
    }
    #[test]
    fn funded_agent_uses_only_explicit_budget_and_transfers_actual_treasury_value() {
        let mut w = fixture();
        context("alice.testnet", 1000, 0);
        w.provide_capital("mira".into());
        context("alice.testnet", 1, 0);
        w.authorize_budget(
            "mira".into(),
            U128(100),
            U128(50),
            vec!["website-build".into()],
            true,
        );
        context("operator.testnet", 0, 0);
        let id = w.open_agent_service_job(
            "mira".into(),
            "alice.testnet".parse().unwrap(),
            "autonomous-001".into(),
            "a".repeat(64),
            vec![allocation("dev", "website-build", 30, None)],
            100,
        );
        assert_eq!(w.get_professional("mira".into()).unwrap().treasury.0, 970);
        assert_eq!(w.treasury_total, 970);
        assert_eq!(w.escrow_total, 30);
        assert_eq!(w.get_policy("mira".into()).unwrap().remaining.0, 70);
        context("operator.testnet", 0, 1);
        w.deliver_service_job(id, vec!["b".repeat(64)]);
        context("operator.testnet", 0, 2);
        w.accept_service_job(id, Some("alice.testnet".parse().unwrap()));
        assert_eq!(w.treasury_total, 1000);
        assert_eq!(w.get_professional("dev".into()).unwrap().treasury.0, 30);
    }
    #[test]
    #[should_panic(expected = "Authorized spending cap exceeded")]
    fn agent_cannot_exceed_owner_cap() {
        let mut w = fixture();
        context("alice.testnet", 1000, 0);
        w.provide_capital("mira".into());
        context("alice.testnet", 1, 0);
        w.authorize_budget(
            "mira".into(),
            U128(100),
            U128(20),
            vec!["website-build".into()],
            true,
        );
        context("operator.testnet", ONE, 0);
        w.open_agent_service_job(
            "mira".into(),
            "alice.testnet".parse().unwrap(),
            "autonomous-001".into(),
            "a".repeat(64),
            vec![allocation("dev", "website-build", 30, None)],
            100,
        );
    }
    #[test]
    fn transfer_preserves_identity_and_capital_but_invalidates_previous_owner_policy() {
        let mut w = fixture();
        context("alice.testnet", 1000, 0);
        w.provide_capital("mira".into());
        context("alice.testnet", 1, 0);
        w.authorize_budget(
            "mira".into(),
            U128(100),
            U128(50),
            vec!["website-build".into()],
            true,
        );
        w.nft_transfer("bob.testnet".parse().unwrap(), "mira".into(), None, None);
        let agent = w.get_professional("mira".into()).unwrap();
        assert_eq!(agent.profession, "hospitality");
        assert_eq!(agent.treasury.0, 1000);
        assert!(w.get_policy("mira".into()).is_none());
    }
    #[test]
    #[should_panic(expected = "Current NFT owner only")]
    fn former_owner_cannot_restore_spending_authority() {
        let mut w = fixture();
        context("alice.testnet", 1, 0);
        w.nft_transfer("bob.testnet".parse().unwrap(), "mira".into(), None, None);
        w.authorize_budget("mira".into(), U128(0), U128(0), vec![], false);
    }
    #[test]
    fn provider_transfer_preserves_existing_obligation_and_its_earned_treasury() {
        let mut w = fixture();
        let id = job(&mut w);
        context("alice.testnet", 1, 1);
        w.nft_transfer("bob.testnet".parse().unwrap(), "dev".into(), None, None);
        let pending = w.get_service_job(id).unwrap();
        assert_eq!(pending.state, "FUNDED");
        assert_eq!(pending.allocations[1].agent_id, "dev");
        assert_eq!(pending.allocations[1].amount.0, 30);
        assert_eq!(
            w.get_professional("dev".into()).unwrap().profession,
            "engineering"
        );
        context("operator.testnet", 0, 2);
        w.deliver_service_job(id, vec!["a".repeat(64), "b".repeat(64), "c".repeat(64)]);
        context("client.testnet", 1, 3);
        w.accept_service_job(id, None);
        assert_eq!(
            w.owner_of(&"dev".into()),
            "bob.testnet".parse::<AccountId>().unwrap()
        );
        assert_eq!(w.get_professional("dev".into()).unwrap().treasury.0, 30);
        assert_eq!(w.escrow_total, 0);
    }
    #[test]
    #[should_panic(expected = "Purchase authority changed after owner transfer")]
    fn old_signed_purchase_cannot_use_a_new_owners_policy() {
        let mut w = fixture();
        context("alice.testnet", 1000, 0);
        w.provide_capital("mira".into());
        context("alice.testnet", 1, 0);
        w.nft_transfer("bob.testnet".parse().unwrap(), "mira".into(), None, None);
        context("bob.testnet", 1, 0);
        w.authorize_budget(
            "mira".into(),
            U128(100),
            U128(50),
            vec!["website-build".into()],
            true,
        );
        context("operator.testnet", 0, 0);
        w.open_agent_service_job(
            "mira".into(),
            "alice.testnet".parse().unwrap(),
            "stale-purchase".into(),
            "a".repeat(64),
            vec![allocation("dev", "website-build", 30, None)],
            100,
        );
    }
    #[test]
    fn expired_work_refunds_and_failed_withdrawal_restores_credit() {
        let mut w = fixture();
        let id = job(&mut w);
        context("client.testnet", 1, 101);
        let before = w.refund_balance("client.testnet".parse().unwrap()).0;
        w.refund_expired_service_job(id);
        assert_eq!(w.escrow_total, 0);
        assert_eq!(
            w.refund_balance("client.testnet".parse().unwrap()).0,
            before + 50
        );
        let credit = w.refund_balance("client.testnet".parse().unwrap());
        let _ = w.withdraw_refund();
        assert_eq!(w.refund_balance("client.testnet".parse().unwrap()).0, 0);
        context("econia.testnet", 0, 102);
        w.resolve_refund(
            "client.testnet".parse().unwrap(),
            credit,
            Err(PromiseError::Failed),
        );
        assert_eq!(w.refund_balance("client.testnet".parse().unwrap()), credit);
    }
    #[test]
    #[should_panic(expected = "Dependency must precede child")]
    fn cyclic_or_forward_subcontract_dependency_rejected() {
        let mut w = fixture();
        context("client.testnet", ONE, 0);
        w.post_service_job(
            "proposal-001".into(),
            "a".repeat(64),
            vec![
                allocation("mira", "procurement-plan", 10, None),
                allocation("dev", "website-build", 30, Some(1)),
            ],
            100,
        );
    }
    #[test]
    fn mainnet_initialization_reports_native_network_and_zero_liabilities() {
        let mut b = VMContextBuilder::new();
        b.current_account_id("econia.near".parse().unwrap());
        testing_env!(b.build());
        let world = ProfessionalWorld::new(
            "owner.near".parse().unwrap(),
            "operator.near".parse().unwrap(),
        );
        assert_eq!(world.custody()["network"], "mainnet");
        assert_eq!(world.custody()["treasuries"], "0");
    }
}

#[cfg(all(test, feature = "native-migration"))]
mod migration_tests {
    use super::*;
    use econia_native_world::EconiaNativeWorld;
    use near_sdk::{test_utils::VMContextBuilder, testing_env};
    fn context(caller: &str, deposit: u128) {
        let mut b = VMContextBuilder::new();
        b.current_account_id("release.near".parse().unwrap())
            .predecessor_account_id(caller.parse().unwrap())
            .signer_account_id(caller.parse().unwrap())
            .account_balance(NearToken::from_near(1000))
            .prepaid_gas(near_sdk::Gas::from_tgas(300))
            .attached_deposit(NearToken::from_yoctonear(deposit));
        testing_env!(b.build());
    }
    fn legacy(capital: bool, paused: bool) {
        context("release.near", 0);
        // Serialize the actual previous crate, not a hand-built approximation.
        let mut w = EconiaNativeWorld::new(
            "release.near".parse().unwrap(),
            "release.near".parse().unwrap(),
        );
        for id in (101..=163).chain(std::iter::once(199)) {
            context("release.near", 10u128.pow(24));
            w.mint_agent(
                format!("person_{id}"),
                "owner.near".parse().unwrap(),
                if id == 199 {
                    "Mira #199".into()
                } else {
                    format!("Legacy #{id}")
                },
                "native-genesis".into(),
            );
        }
        context("owner.near", 10u128.pow(24));
        w.nft_approve("person_199".into(), "market.near".parse().unwrap(), None);
        if capital {
            context("release.near", 100);
            w.provide_capital("person_199".into());
        }
        context("release.near", 1);
        w.set_world_paused(paused);
        context("release.near", 0);
        env::state_write(&w);
    }
    fn profiles() -> Vec<GenesisProfile> {
        vec![
            GenesisProfile {
                agent_id: "person_199".into(),
                name: "Mira".into(),
                profession: "hospitality".into(),
                services: vec!["menu-plan".into()],
                provenance: "genesis-2".into(),
            },
            GenesisProfile {
                agent_id: "person_042".into(),
                name: "Dev".into(),
                profession: "engineering".into(),
                services: vec!["website-build".into()],
                provenance: "genesis-2".into(),
            },
        ]
    }
    #[test]
    fn migrate_actual_native_layout_preserves_all_64_nfts_metadata_approvals_and_owners() {
        legacy(false, true);
        let old: LegacyWorld = env::state_read().unwrap();
        let previous = old.tokens.nft_tokens(None, Some(100));
        let w = ProfessionalWorld::migrate_native(profiles(), 64);
        assert_eq!(w.nft_total_supply().0, 65);
        for token in previous {
            let current = w.nft_token(token.token_id.clone()).unwrap();
            assert_eq!(
                near_sdk::serde_json::to_value(&token).unwrap(),
                near_sdk::serde_json::to_value(&current).unwrap()
            );
            if token.token_id != "person_199" {
                assert!(w.get_professional(token.token_id.clone()).is_none());
            } else {
                assert_eq!(
                    w.get_professional(token.token_id.clone())
                        .unwrap()
                        .treasury
                        .0,
                    0
                );
            }
        }
        assert_eq!(
            w.nft_token("person_042".into()).unwrap().owner_id.as_str(),
            "release.near"
        );
        assert_eq!(
            w.get_professional("person_199".into()).unwrap().profession,
            "hospitality"
        );
        assert_eq!(w.execution_storage, 0);
        assert_eq!(w.custody()["network"], "mainnet");
    }
    #[test]
    #[should_panic(expected = "no financial obligations")]
    fn refuses_to_discard_any_existing_capital() {
        legacy(true, true);
        ProfessionalWorld::migrate_native(profiles(), 64);
    }
    #[test]
    #[should_panic(expected = "no financial obligations")]
    fn refuses_active_legacy_world() {
        legacy(false, false);
        ProfessionalWorld::migrate_native(profiles(), 64);
    }
    #[test]
    #[should_panic(expected = "Private migration only")]
    fn refuses_external_migration() {
        legacy(false, true);
        context("attacker.near", 0);
        ProfessionalWorld::migrate_native(profiles(), 64);
    }
    #[test]
    #[should_panic(expected = "identity name mismatch")]
    fn refuses_relabeling_an_existing_identity() {
        legacy(false, true);
        let mut p = profiles();
        p[0].name = "Someone Else".into();
        ProfessionalWorld::migrate_native(p, 64);
    }
}
