//! New deployment only. Native NEAR treasury stays attached to immutable NFT ID.
//! Legacy ECO contracts are not migrated or relabelled by this contract.
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
    assert_one_yocto, env, ext_contract, near, require, AccountId, NearToken, PanicOnDefault,
    Promise, PromiseError, PromiseOrValue,
};
use near_sdk::{collections::LookupMap, json_types::U128};
use std::collections::HashMap;

#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Agent {
    pub treasury: U128,
    pub capital_received: U128,
    pub paused: bool,
    pub provenance: String,
}
#[near(serializers=[json])]
pub struct Movement {
    pub from: String,
    pub to: String,
    pub amount: U128,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Job {
    pub customer: AccountId,
    pub agent_id: String,
    pub payment: U128,
    pub deadline: u64,
    pub delivered: bool,
    pub evidence: Option<String>,
}
#[ext_contract(ext_self)]
pub trait Callbacks {
    fn resolve_refund(
        &mut self,
        account: AccountId,
        amount: U128,
        #[callback_result] result: Result<(), PromiseError>,
    );
}
#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct EconiaNativeWorld {
    owner: AccountId,
    operator: AccountId,
    tokens: NonFungibleToken,
    agents: LookupMap<String, Agent>,
    jobs: LookupMap<u64, Job>,
    refunds: LookupMap<AccountId, u128>,
    next_job: u64,
    treasury_total: u128,
    job_total: u128,
    refund_total: u128,
    last_batch: u64,
    paused: bool,
}
impl EconiaNativeWorld {
    fn admin(&self) {
        require!(env::predecessor_account_id() == self.owner, "Owner only");
    }
    fn agent_owner(&self, id: &String) {
        require!(
            self.tokens.owner_by_id.get(id) == Some(env::predecessor_account_id()),
            "NFT owner only"
        );
    }
    fn live(&self) {
        require!(!self.paused, "World paused");
    }
    fn event(&self, event: &str, data: near_sdk::serde_json::Value) {
        env::log_str(&format!(
            "EVENT_JSON:{}",
            near_sdk::serde_json::json!({"standard":"econia","version":"2.0.0","event":event,"data":[data]})
        ));
    }
    fn liability(&self) -> u128 {
        self.treasury_total
            .checked_add(self.job_total)
            .unwrap()
            .checked_add(self.refund_total)
            .unwrap()
    }
    fn backed(&self) {
        let storage = env::storage_byte_cost().as_yoctonear() * u128::from(env::storage_usage());
        require!(
            env::account_balance().as_yoctonear() >= self.liability().checked_add(storage).unwrap(),
            "Custody or storage backing insufficient"
        );
    }
    fn refund_credit(&mut self, account: &AccountId, amount: u128) {
        let current = self.refunds.get(account).unwrap_or(0);
        self.refunds
            .insert(account, &current.checked_add(amount).unwrap());
        self.refund_total = self.refund_total.checked_add(amount).unwrap();
    }
}
#[near]
impl EconiaNativeWorld {
    #[init]
    pub fn new(owner_id: AccountId, operator_id: AccountId) -> Self {
        Self {
            owner: owner_id.clone(),
            operator: operator_id,
            tokens: NonFungibleToken::new(b"n", owner_id, Some(b"m"), Some(b"o"), Some(b"a")),
            agents: LookupMap::new(b"r"),
            jobs: LookupMap::new(b"j"),
            refunds: LookupMap::new(b"f"),
            next_job: 0,
            treasury_total: 0,
            job_total: 0,
            refund_total: 0,
            last_batch: 0,
            paused: false,
        }
    }
    #[payable]
    pub fn mint_agent(
        &mut self,
        agent_id: String,
        receiver_id: AccountId,
        name: String,
        provenance: String,
    ) -> Token {
        self.admin();
        require!(
            !agent_id.is_empty()
                && agent_id.len() <= 64
                && name.len() <= 100
                && provenance.len() <= 256,
            "Metadata bounds"
        );
        require!(self.agents.get(&agent_id).is_none(), "Existing identity");
        let before = env::storage_usage();
        let token=self.tokens.internal_mint(agent_id.clone(),receiver_id,Some(TokenMetadata{title:Some(name),description:Some("Persistent Econia agent. Native NEAR operating treasury transfers with the NFT. Capital is not a guaranteed return.".into()),..Default::default()}));
        self.agents.insert(
            &agent_id,
            &Agent {
                treasury: U128(0),
                capital_received: U128(0),
                paused: false,
                provenance,
            },
        );
        let cost =
            env::storage_byte_cost().as_yoctonear() * u128::from(env::storage_usage() - before);
        require!(
            env::attached_deposit().as_yoctonear() >= cost,
            "Mint storage deposit required"
        );
        self.backed();
        token
    }
    pub fn get_agent(&self, agent_id: String) -> Option<Agent> {
        self.agents.get(&agent_id)
    }
    pub fn custody(&self) -> near_sdk::serde_json::Value {
        near_sdk::serde_json::json!({"asset":"NEAR","decimals":24,"treasuries":self.treasury_total.to_string(),"jobs":self.job_total.to_string(),"refunds":self.refund_total.to_string(),"last_batch":self.last_batch,"paused":self.paused})
    }
    #[payable]
    pub fn provide_capital(&mut self, agent_id: String) {
        self.live();
        let mut a = self.agents.get(&agent_id).expect("Unknown agent");
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "Attach operating capital");
        a.treasury.0 = a.treasury.0.checked_add(amount).unwrap();
        a.capital_received.0 = a.capital_received.0.checked_add(amount).unwrap();
        self.treasury_total = self.treasury_total.checked_add(amount).unwrap();
        self.agents.insert(&agent_id, &a);
        self.backed();
        self.event("operating_capital",near_sdk::serde_json::json!({"agent_id":agent_id,"amount":amount.to_string(),"sender":env::predecessor_account_id()}));
    }
    #[payable]
    pub fn set_agent_paused(&mut self, agent_id: String, paused: bool) {
        assert_one_yocto();
        self.agent_owner(&agent_id);
        let mut a = self.agents.get(&agent_id).expect("Unknown agent");
        a.paused = paused;
        self.agents.insert(&agent_id, &a);
    }
    #[payable]
    pub fn set_world_paused(&mut self, paused: bool) {
        assert_one_yocto();
        self.admin();
        self.paused = paused;
    }
    pub fn settle_batch(&mut self, batch_id: u64, movements: Vec<Movement>) {
        self.live();
        require!(
            env::predecessor_account_id() == self.operator,
            "Operator only"
        );
        require!(
            batch_id == self.last_batch.checked_add(1).unwrap(),
            "Settlement sequence mismatch"
        );
        require!(movements.len() <= 50, "Batch bound");
        for m in movements {
            require!(m.from != m.to && m.amount.0 > 0, "Invalid movement");
            let mut from = self.agents.get(&m.from).expect("Unknown sender");
            let mut to = self.agents.get(&m.to).expect("Unknown recipient");
            require!(!from.paused && !to.paused, "Agent paused");
            from.treasury.0 = from
                .treasury
                .0
                .checked_sub(m.amount.0)
                .expect("Insufficient treasury");
            to.treasury.0 = to.treasury.0.checked_add(m.amount.0).unwrap();
            self.agents.insert(&m.from, &from);
            self.agents.insert(&m.to, &to);
        }
        self.last_batch = batch_id;
        self.backed();
    }
    #[payable]
    pub fn post_job(&mut self, agent_id: String, deadline: u64) -> u64 {
        self.live();
        require!(self.agents.get(&agent_id).is_some(), "Unknown agent");
        require!(
            deadline > env::block_timestamp()
                && deadline - env::block_timestamp() <= 30 * 24 * 3600 * 1_000_000_000,
            "Deadline bound"
        );
        let id = self.next_job;
        self.next_job = id.checked_add(1).unwrap();
        let before = env::storage_usage();
        let amount = env::attached_deposit().as_yoctonear();
        self.jobs.insert(
            &id,
            &Job {
                customer: env::predecessor_account_id(),
                agent_id,
                payment: U128(0),
                deadline,
                delivered: false,
                evidence: None,
            },
        );
        let storage = env::storage_byte_cost().as_yoctonear()
            * u128::from(env::storage_usage() - before + 512);
        require!(amount > storage, "Payment must cover job storage");
        let mut j = self.jobs.get(&id).unwrap();
        j.payment = U128(amount - storage);
        self.job_total = self.job_total.checked_add(j.payment.0).unwrap();
        self.jobs.insert(&id, &j);
        self.backed();
        id
    }
    pub fn get_job(&self, job_id: u64) -> Option<Job> {
        self.jobs.get(&job_id)
    }
    pub fn deliver_job(&mut self, job_id: u64, evidence: String) {
        self.live();
        require!(
            env::predecessor_account_id() == self.operator,
            "Operator only"
        );
        let mut j = self.jobs.get(&job_id).expect("Unknown job");
        require!(
            env::block_timestamp() <= j.deadline && !j.delivered,
            "Not deliverable"
        );
        require!(
            !evidence.is_empty() && evidence.len() <= 256,
            "Evidence bounds"
        );
        j.delivered = true;
        j.evidence = Some(evidence);
        self.jobs.insert(&job_id, &j);
        self.backed();
    }
    #[payable]
    pub fn accept_job(&mut self, job_id: u64) {
        assert_one_yocto();
        self.live();
        let j = self.jobs.get(&job_id).expect("Unknown job");
        require!(env::predecessor_account_id() == j.customer, "Customer only");
        require!(j.delivered, "Deliverable required");
        let mut a = self.agents.get(&j.agent_id).unwrap();
        a.treasury.0 = a.treasury.0.checked_add(j.payment.0).unwrap();
        self.treasury_total = self.treasury_total.checked_add(j.payment.0).unwrap();
        self.job_total -= j.payment.0;
        self.jobs.remove(&job_id);
        self.agents.insert(&j.agent_id, &a);
        self.backed();
    }
    #[payable]
    pub fn refund_expired_job(&mut self, job_id: u64) {
        assert_one_yocto();
        let j = self.jobs.get(&job_id).expect("Unknown job");
        require!(env::predecessor_account_id() == j.customer, "Customer only");
        require!(env::block_timestamp() > j.deadline, "Not expired");
        self.jobs.remove(&job_id);
        self.job_total -= j.payment.0;
        self.refund_credit(&j.customer, j.payment.0);
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
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(near_sdk::Gas::from_tgas(15))
                    .resolve_refund(account, U128(amount)),
            )
    }
    #[private]
    pub fn resolve_refund(
        &mut self,
        account: AccountId,
        amount: U128,
        #[callback_result] result: Result<(), PromiseError>,
    ) {
        if result.is_err() {
            self.refund_credit(&account, amount.0);
        }
    }
}
#[near]
impl NonFungibleTokenCore for EconiaNativeWorld {
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
impl NonFungibleTokenResolver for EconiaNativeWorld {
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
impl NonFungibleTokenApproval for EconiaNativeWorld {
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
impl NonFungibleTokenEnumeration for EconiaNativeWorld {
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
impl NonFungibleTokenMetadataProvider for EconiaNativeWorld {
    fn nft_metadata(&self) -> NFTContractMetadata {
        NFTContractMetadata {
            spec: NFT_METADATA_SPEC.into(),
            name: "Econia Agents".into(),
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
    fn context(who: &str, deposit: u128, time: u64) {
        testing_env!(VMContextBuilder::new()
            .current_account_id("econia.testnet".parse().unwrap())
            .predecessor_account_id(who.parse().unwrap())
            .account_balance(NearToken::from_near(100))
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(time)
            .build());
    }
    fn fixture() -> EconiaNativeWorld {
        context("admin.testnet", 0, 0);
        let mut w = EconiaNativeWorld::new(
            "admin.testnet".parse().unwrap(),
            "worker.testnet".parse().unwrap(),
        );
        context("admin.testnet", 10u128.pow(24), 0);
        for id in ["mira", "leo"] {
            w.mint_agent(
                id.into(),
                "alice.testnet".parse().unwrap(),
                id.into(),
                "founding".into(),
            );
        }
        w
    }
    #[test]
    fn capital_moves_with_nft_and_market_approval_is_cleared() {
        let mut w = fixture();
        context("patron.testnet", 10u128.pow(24), 0);
        w.provide_capital("mira".into());
        context("alice.testnet", 10u128.pow(23), 0);
        w.nft_approve("mira".into(), "market.testnet".parse().unwrap(), None);
        let id = w
            .nft_token("mira".into())
            .unwrap()
            .approved_account_ids
            .unwrap()[&"market.testnet".parse::<AccountId>().unwrap()];
        context("market.testnet", 1, 0);
        w.nft_transfer(
            "bob.testnet".parse().unwrap(),
            "mira".into(),
            Some(id),
            None,
        );
        assert_eq!(
            w.get_agent("mira".into()).unwrap().treasury.0,
            10u128.pow(24)
        );
        assert_eq!(
            w.nft_token("mira".into()).unwrap().owner_id.as_str(),
            "bob.testnet"
        );
        assert!(!w.nft_is_approved("mira".into(), "market.testnet".parse().unwrap(), None));
    }
    #[test]
    fn job_acceptance_funds_agent_without_minting_money() {
        let mut w = fixture();
        context("client.testnet", 10u128.pow(24), 0);
        let id = w.post_job("mira".into(), 1000);
        let payment = w.get_job(id).unwrap().payment.0;
        context("worker.testnet", 0, 10);
        w.deliver_job(id, "sha256:deliverable".into());
        context("client.testnet", 1, 20);
        w.accept_job(id);
        assert_eq!(w.job_total, 0);
        assert_eq!(w.treasury_total, payment);
        assert_eq!(w.get_agent("mira".into()).unwrap().treasury.0, payment);
        assert!(w.get_job(id).is_none());
    }
    #[test]
    fn expired_payment_is_refundable_and_failed_withdrawal_restores_credit() {
        let mut w = fixture();
        context("client.testnet", 10u128.pow(24), 0);
        let id = w.post_job("mira".into(), 100);
        let amount = w.get_job(id).unwrap().payment;
        context("client.testnet", 1, 101);
        w.refund_expired_job(id);
        assert_eq!(w.refund_total, amount.0);
        w.withdraw_refund();
        assert_eq!(w.refund_total, 0);
        context("econia.testnet", 0, 102);
        w.resolve_refund(
            "client.testnet".parse().unwrap(),
            amount,
            Err(PromiseError::Failed),
        );
        assert_eq!(w.refund_total, amount.0);
    }
    #[test]
    fn settlement_conserves_native_treasuries() {
        let mut w = fixture();
        context("alice.testnet", 10u128.pow(24), 0);
        w.provide_capital("mira".into());
        context("worker.testnet", 0, 0);
        w.settle_batch(
            1,
            vec![Movement {
                from: "mira".into(),
                to: "leo".into(),
                amount: U128(100),
            }],
        );
        assert_eq!(w.get_agent("leo".into()).unwrap().treasury.0, 100);
        assert_eq!(w.treasury_total, 10u128.pow(24));
    }
    #[test]
    #[should_panic(expected = "NFT owner only")]
    fn former_owner_has_no_control() {
        let mut w = fixture();
        context("alice.testnet", 1, 0);
        w.nft_transfer("bob.testnet".parse().unwrap(), "mira".into(), None, None);
        w.set_agent_paused("mira".into(), true);
    }
    #[test]
    #[should_panic(expected = "Customer only")]
    fn operator_cannot_release_customer_payment() {
        let mut w = fixture();
        context("client.testnet", 10u128.pow(24), 0);
        let id = w.post_job("mira".into(), 1000);
        context("worker.testnet", 0, 10);
        w.deliver_job(id, "proof".into());
        context("worker.testnet", 1, 20);
        w.accept_job(id);
    }
}
