use near_contract_standards::fungible_token::{core::ext_ft_core, receiver::FungibleTokenReceiver};
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
    assert_one_yocto, env, ext_contract, near, require, AccountId, Gas, NearToken, PanicOnDefault,
    Promise, PromiseError, PromiseOrValue,
};
use near_sdk::{
    collections::{LookupMap, UnorderedSet},
    json_types::U128,
};
use std::collections::HashMap;

#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct RegistryEntry {
    pub entity_type: String,
    pub treasury: U128,
    pub sponsored: U128,
    pub provenance: String,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Listing {
    pub seller: AccountId,
    pub ask: U128,
}
#[near(serializers=[borsh,json])]
#[derive(Clone)]
pub struct Offer {
    pub seller: AccountId,
    pub buyer: AccountId,
    pub amount: U128,
}
#[near(serializers=[json])]
pub struct Movement {
    pub from: String,
    pub to: String,
    pub amount: U128,
}
#[near(serializers=[json])]
pub struct Allocation {
    pub entity_id: String,
    pub amount: U128,
}
#[near(serializers=[json])]
pub struct MintRequest {
    pub entity_id: String,
    pub receiver_id: AccountId,
    pub entity_type: String,
    pub name: String,
    pub provenance: String,
}
#[near(serializers=[json])]
#[serde(tag = "kind")]
pub enum DepositMessage {
    Sponsor { entity_id: String },
    Genesis { entity_id: String },
    GenesisBatch { allocations: Vec<Allocation> },
    Buy { entity_id: String },
    Offer { entity_id: String },
    Deposit {},
}
#[ext_contract(ext_self)]
pub trait Callback {
    fn resolve_withdraw(
        &mut self,
        account_id: AccountId,
        amount: U128,
        #[callback_result] result: Result<(), PromiseError>,
    );
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct EconiaWorld {
    owner: AccountId,
    operator: AccountId,
    eco_contract: AccountId,
    tokens: NonFungibleToken,
    registry: LookupMap<String, RegistryEntry>,
    listings: LookupMap<String, Listing>,
    balances: LookupMap<AccountId, u128>,
    registered: UnorderedSet<AccountId>,
    offers: LookupMap<String, Offer>,
    offer_counts: LookupMap<AccountId, u8>,
    last_batch: u64,
    last_hash: String,
    escrow_total: u128,
    sequence: u64,
}
impl EconiaWorld {
    fn only_owner(&self) {
        require!(env::predecessor_account_id() == self.owner, "Owner only");
    }
    fn log(&mut self, event: &str, data: near_sdk::serde_json::Value) {
        self.sequence += 1;
        env::log_str(&format!(
            "EVENT_JSON:{}",
            near_sdk::serde_json::json!({"standard":"econia","version":"1.0.0","event":event,"data":[{"sequence":self.sequence,"value":data}]})
        ));
    }
    fn credit(&mut self, account: &AccountId, amount: u128) {
        let balance = self.balances.get(account).unwrap_or(0);
        self.balances
            .insert(account, &balance.checked_add(amount).expect("Overflow"));
    }
}
#[near]
impl EconiaWorld {
    #[init]
    pub fn new(owner_id: AccountId, operator_id: AccountId, eco_contract: AccountId) -> Self {
        require!(
            env::current_account_id().as_str().ends_with(".testnet")
                && eco_contract.as_str().ends_with(".testnet"),
            "Testnet only"
        );
        Self {
            owner: owner_id.clone(),
            operator: operator_id,
            eco_contract,
            tokens: NonFungibleToken::new(b"n", owner_id, Some(b"m"), Some(b"o"), Some(b"a")),
            registry: LookupMap::new(b"r"),
            listings: LookupMap::new(b"l"),
            balances: LookupMap::new(b"b"),
            registered: UnorderedSet::new(b"u"),
            offers: LookupMap::new(b"q"),
            offer_counts: LookupMap::new(b"c"),
            last_batch: 0,
            last_hash: String::new(),
            escrow_total: 0,
            sequence: 0,
        }
    }
    #[payable]
    pub fn register_wallet(&mut self) {
        require!(
            env::attached_deposit() >= NearToken::from_millinear(10),
            "Attach 0.01 NEAR for bounded wallet storage"
        );
        let account = env::predecessor_account_id();
        require!(!self.registered.contains(&account), "Already registered");
        self.registered.insert(&account);
        self.balances.insert(&account, &0);
    }
    pub fn wallet_registered(&self, account_id: AccountId) -> bool {
        self.registered.contains(&account_id)
    }
    #[payable]
    pub fn mint_batch(&mut self, entities: Vec<MintRequest>) -> Vec<Token> {
        self.only_owner();
        require!(!entities.is_empty() && entities.len() <= 10, "Batch bounds");
        let start = env::storage_usage();
        let mut minted = vec![];
        for e in entities {
            minted.push(self.mint_entity(
                e.entity_id,
                e.receiver_id,
                e.entity_type,
                e.name,
                e.provenance,
            ));
        }
        let cost =
            env::storage_byte_cost().as_yoctonear() * u128::from(env::storage_usage() - start);
        require!(
            env::attached_deposit().as_yoctonear() >= cost,
            "Insufficient batch storage deposit"
        );
        minted
    }
    #[payable]
    pub fn mint_entity(
        &mut self,
        entity_id: String,
        receiver_id: AccountId,
        entity_type: String,
        name: String,
        provenance: String,
    ) -> Token {
        self.only_owner();
        require!(
            entity_id.len() <= 64
                && !entity_id.is_empty()
                && name.len() <= 80
                && provenance.len() <= 128,
            "Identity bounds"
        );
        require!(
            ["PERSON", "BUSINESS", "PROPERTY", "MACHINE", "ORGANIZATION"]
                .contains(&entity_type.as_str()),
            "Unknown entity type"
        );
        require!(
            self.registry.get(&entity_id).is_none(),
            "Entity already exists"
        );
        let start = env::storage_usage();
        self.registry.insert(
            &entity_id,
            &RegistryEntry {
                entity_type: entity_type.clone(),
                treasury: U128(0),
                sponsored: U128(0),
                provenance: provenance.clone(),
            },
        );
        let metadata=TokenMetadata{title:Some(name),description:Some("A persistent Living Entity in Econia. Economic state survives ownership changes.".into()),extra:Some(near_sdk::serde_json::json!({"entityId":entity_id,"type":entity_type,"generation":0,"provenance":provenance}).to_string()),..Default::default()};
        let token = self.tokens.internal_mint_with_refund(
            entity_id.clone(),
            receiver_id,
            Some(metadata),
            None,
        );
        near_contract_standards::non_fungible_token::events::NftMint {
            owner_id: &token.owner_id,
            token_ids: &[&token.token_id],
            memo: None,
        }
        .emit();
        let cost =
            env::storage_byte_cost().as_yoctonear() * u128::from(env::storage_usage() - start);
        require!(
            env::attached_deposit().as_yoctonear() >= cost,
            "Insufficient entity storage deposit"
        );
        self.log(
            "entity_created",
            near_sdk::serde_json::json!({"entity_id":entity_id}),
        );
        token
    }
    pub fn get_entity(&self, entity_id: String) -> Option<RegistryEntry> {
        self.registry.get(&entity_id)
    }
    pub fn get_listing(&self, entity_id: String) -> Option<Listing> {
        self.listings.get(&entity_id)
    }
    pub fn get_offer(&self, entity_id: String, buyer: AccountId) -> Option<Offer> {
        self.offers.get(&format!("{}:{}", entity_id, buyer))
    }
    #[payable]
    pub fn cancel_offer(&mut self, entity_id: String) {
        assert_one_yocto();
        let buyer = env::predecessor_account_id();
        let key = format!("{}:{}", entity_id, buyer);
        let offer = self.offers.remove(&key).expect("No offer");
        self.credit(&buyer, offer.amount.0);
        let count = self.offer_counts.get(&buyer).unwrap_or(1);
        self.offer_counts.insert(&buyer, &(count - 1));
        self.log("offer_cancelled",near_sdk::serde_json::json!({"entity_id":entity_id,"buyer":buyer,"amount":offer.amount}));
    }
    #[payable]
    pub fn accept_offer(&mut self, entity_id: String, buyer: AccountId) {
        assert_one_yocto();
        let seller = env::predecessor_account_id();
        let key = format!("{}:{}", entity_id, buyer);
        let offer = self.offers.get(&key).expect("No offer");
        require!(
            offer.seller == seller
                && self.tokens.owner_by_id.get(&entity_id) == Some(seller.clone()),
            "Current NFT owner and original seller only"
        );
        self.tokens
            .internal_transfer(&seller, &buyer, &entity_id, None, None);
        self.offers.remove(&key);
        self.listings.remove(&entity_id);
        let count = self.offer_counts.get(&buyer).unwrap_or(1);
        self.offer_counts.insert(&buyer, &(count - 1));
        self.credit(&seller, offer.amount.0);
        self.log("asset_sold",near_sdk::serde_json::json!({"entity_id":entity_id,"seller":seller,"buyer":buyer,"amount":offer.amount}));
    }
    pub fn wallet_balance(&self, account_id: AccountId) -> U128 {
        U128(self.balances.get(&account_id).unwrap_or(0))
    }
    pub fn settlement_state(&self) -> near_sdk::serde_json::Value {
        near_sdk::serde_json::json!({"last_batch":self.last_batch,"last_hash":self.last_hash,"escrow_total":self.escrow_total.to_string(),"sequence":self.sequence})
    }
    #[payable]
    pub fn list_asset(&mut self, entity_id: String, ask: U128) {
        assert_one_yocto();
        require!(ask.0 > 0, "Positive ask required");
        let seller = env::predecessor_account_id();
        require!(
            self.tokens.owner_by_id.get(&entity_id) == Some(seller.clone()),
            "NFT owner only"
        );
        self.listings.insert(&entity_id, &Listing { seller, ask });
        self.log(
            "asset_listed",
            near_sdk::serde_json::json!({"entity_id":entity_id,"ask":ask}),
        );
    }
    #[payable]
    pub fn cancel_listing(&mut self, entity_id: String) {
        assert_one_yocto();
        let listing = self.listings.get(&entity_id).expect("No listing");
        require!(
            listing.seller == env::predecessor_account_id(),
            "Seller only"
        );
        self.listings.remove(&entity_id);
    }
    // Transfers between pre-existing entity escrow accounts, never arbitrary wallet addresses.
    // Strict sequence makes retries idempotent without unbounded batch-key storage.
    pub fn settle_batch(&mut self, batch_id: u64, state_hash: String, movements: Vec<Movement>) {
        require!(
            env::predecessor_account_id() == self.operator,
            "Operator only"
        );
        if batch_id == self.last_batch {
            require!(state_hash == self.last_hash, "Conflicting retry");
            return;
        }
        require!(
            batch_id == self.last_batch + 1 && movements.len() <= 50 && state_hash.len() == 64,
            "Invalid settlement sequence or bounds"
        );
        // Preflight every movement in an isolated temporary map before any writes.
        let mut next: HashMap<String, RegistryEntry> = HashMap::new();
        for m in &movements {
            require!(m.amount.0 > 0 && m.from != m.to, "Invalid movement");
            for id in [&m.from, &m.to] {
                if !next.contains_key(id) {
                    next.insert(id.clone(), self.registry.get(id).expect("Unknown treasury"));
                }
            }
            let from = next.get_mut(&m.from).unwrap();
            from.treasury.0 = from
                .treasury
                .0
                .checked_sub(m.amount.0)
                .expect("Insufficient treasury");
            let to = next.get_mut(&m.to).unwrap();
            to.treasury.0 = to.treasury.0.checked_add(m.amount.0).expect("Overflow");
        }
        for (id, entry) in next {
            self.registry.insert(&id, &entry);
        }
        self.last_batch = batch_id;
        self.last_hash = state_hash;
        self.log(
            "batch_settled",
            near_sdk::serde_json::json!({"batch_id":batch_id,"state_hash":self.last_hash}),
        );
    }
    #[payable]
    pub fn withdraw(&mut self, amount: U128) -> Promise {
        assert_one_yocto();
        let account = env::predecessor_account_id();
        let balance = self.balances.get(&account).unwrap_or(0);
        require!(
            amount.0 > 0 && balance >= amount.0,
            "Insufficient available balance"
        );
        self.balances.insert(&account, &(balance - amount.0));
        self.escrow_total -= amount.0;
        ext_ft_core::ext(self.eco_contract.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(Gas::from_tgas(30))
            .ft_transfer(account.clone(), amount, Some("Econia withdrawal".into()))
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(Gas::from_tgas(10))
                    .resolve_withdraw(account, amount),
            )
    }
    #[private]
    pub fn resolve_withdraw(
        &mut self,
        account_id: AccountId,
        amount: U128,
        #[callback_result] result: Result<(), PromiseError>,
    ) {
        if result.is_err() {
            self.credit(&account_id, amount.0);
            self.escrow_total = self.escrow_total.checked_add(amount.0).expect("Overflow");
        }
    }
}
#[near]
impl FungibleTokenReceiver for EconiaWorld {
    fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        require!(
            env::predecessor_account_id() == self.eco_contract,
            "ECO contract only"
        );
        require!(amount.0 > 0 && msg.len() <= 4096, "Invalid deposit");
        require!(
            self.registered.contains(&sender_id),
            "Register wallet first"
        );
        let message: DepositMessage =
            near_sdk::serde_json::from_str(&msg).expect("Invalid message");
        match message {
            DepositMessage::GenesisBatch { allocations } => {
                require!(
                    sender_id == self.owner && allocations.len() <= 20 && !allocations.is_empty(),
                    "Genesis distributor or batch bounds"
                );
                let total = allocations
                    .iter()
                    .try_fold(0u128, |n, a| n.checked_add(a.amount.0))
                    .expect("Overflow");
                require!(total == amount.0, "Allocation total mismatch");
                for a in allocations {
                    let mut entry = self.registry.get(&a.entity_id).expect("Unknown entity");
                    require!(
                        entry.treasury.0 == 0 && entry.sponsored.0 == 0,
                        "Treasury already funded"
                    );
                    entry.treasury = a.amount;
                    self.registry.insert(&a.entity_id, &entry);
                    self.log(
                        "genesis_funded",
                        near_sdk::serde_json::json!({"entity_id":a.entity_id,"amount":a.amount}),
                    );
                }
            }
            DepositMessage::Genesis { entity_id } => {
                require!(sender_id == self.owner, "Genesis distributor only");
                let mut entry = self.registry.get(&entity_id).expect("Unknown entity");
                require!(
                    entry.treasury.0 == 0 && entry.sponsored.0 == 0,
                    "Treasury already funded"
                );
                entry.treasury = amount;
                self.registry.insert(&entity_id, &entry);
                self.log(
                    "genesis_funded",
                    near_sdk::serde_json::json!({"entity_id":entity_id,"amount":amount}),
                );
            }
            DepositMessage::Sponsor { entity_id } => {
                require!(
                    self.tokens.owner_by_id.get(&entity_id) == Some(sender_id.clone()),
                    "NFT owner only"
                );
                let mut entry = self.registry.get(&entity_id).expect("Unknown entity");
                entry.treasury.0 = entry.treasury.0.checked_add(amount.0).expect("Overflow");
                entry.sponsored.0 = entry.sponsored.0.checked_add(amount.0).expect("Overflow");
                self.registry.insert(&entity_id, &entry);
                self.log("sponsorship",near_sdk::serde_json::json!({"entity_id":entity_id,"sender":sender_id,"amount":amount,"treasury":entry.treasury,"timestamp":env::block_timestamp().to_string()}));
            }
            DepositMessage::Buy { entity_id } => {
                let listing = self.listings.get(&entity_id).expect("No active listing");
                require!(
                    sender_id != listing.seller && amount.0 == listing.ask.0,
                    "Exact ask required; no self purchase"
                );
                require!(
                    self.registered.contains(&listing.seller),
                    "Seller registration required"
                );
                require!(
                    self.tokens.owner_by_id.get(&entity_id) == Some(listing.seller.clone()),
                    "Stale listing"
                );
                self.tokens
                    .internal_transfer(&listing.seller, &sender_id, &entity_id, None, None);
                self.listings.remove(&entity_id);
                self.credit(&listing.seller, amount.0);
                self.log("asset_sold",near_sdk::serde_json::json!({"entity_id":entity_id,"seller":listing.seller,"buyer":sender_id,"amount":amount}));
            }
            DepositMessage::Deposit {} => self.credit(&sender_id, amount.0),
            DepositMessage::Offer { entity_id } => {
                let listing = self.listings.get(&entity_id).expect("No active listing");
                require!(
                    listing.seller != sender_id
                        && self.tokens.owner_by_id.get(&entity_id) == Some(listing.seller.clone()),
                    "Invalid or stale listing"
                );
                require!(
                    self.registered.contains(&listing.seller),
                    "Seller registration required"
                );
                let key = format!("{}:{}", entity_id, sender_id);
                require!(
                    self.offers.get(&key).is_none(),
                    "Cancel existing offer first"
                );
                let count = self.offer_counts.get(&sender_id).unwrap_or(0);
                require!(count < 8, "Maximum 8 open offers per wallet");
                self.offers.insert(
                    &key,
                    &Offer {
                        seller: listing.seller,
                        buyer: sender_id.clone(),
                        amount,
                    },
                );
                self.offer_counts.insert(&sender_id, &(count + 1));
                self.log("offer_created",near_sdk::serde_json::json!({"entity_id":entity_id,"buyer":sender_id,"amount":amount}));
            }
        }
        self.escrow_total = self.escrow_total.checked_add(amount.0).expect("Overflow");
        PromiseOrValue::Value(U128(0))
    }
}
#[near]
impl NonFungibleTokenCore for EconiaWorld {
    #[payable]
    fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) {
        self.tokens
            .nft_transfer(receiver_id, token_id.clone(), approval_id, memo);
        self.listings.remove(&token_id);
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
        let result =
            self.tokens
                .nft_transfer_call(receiver_id, token_id.clone(), approval_id, memo, msg);
        self.listings.remove(&token_id);
        result
    }
    fn nft_token(&self, token_id: TokenId) -> Option<Token> {
        self.tokens.nft_token(token_id)
    }
}
#[near]
impl NonFungibleTokenResolver for EconiaWorld {
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
impl NonFungibleTokenApproval for EconiaWorld {
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
impl NonFungibleTokenEnumeration for EconiaWorld {
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
impl NonFungibleTokenMetadataProvider for EconiaWorld {
    fn nft_metadata(&self) -> NFTContractMetadata {
        NFTContractMetadata {
            spec: NFT_METADATA_SPEC.into(),
            name: "Econia Living Entities".into(),
            symbol: "LIFE".into(),
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
    fn setup(who: &str, deposit: u128) {
        testing_env!(VMContextBuilder::new()
            .current_account_id("world.econia.testnet".parse().unwrap())
            .predecessor_account_id(who.parse().unwrap())
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .build());
    }
    fn fixture() -> EconiaWorld {
        setup("admin.testnet", 0);
        let mut w = EconiaWorld::new(
            "admin.testnet".parse().unwrap(),
            "worker.testnet".parse().unwrap(),
            "eco.econia.testnet".parse().unwrap(),
        );
        setup("alice.testnet", 10u128.pow(23));
        w.register_wallet();
        setup("bob.testnet", 10u128.pow(23));
        w.register_wallet();
        setup("admin.testnet", 10u128.pow(23));
        w.mint_entity(
            "mira".into(),
            "alice.testnet".parse().unwrap(),
            "PERSON".into(),
            "Mira #199".into(),
            "genesis".into(),
        );
        w.mint_entity(
            "bakery".into(),
            "alice.testnet".parse().unwrap(),
            "BUSINESS".into(),
            "Bakery".into(),
            "genesis".into(),
        );
        w
    }
    #[test]
    fn sponsor_settle_and_sale_preserve_treasury() {
        let mut w = fixture();
        setup("eco.econia.testnet", 0);
        w.ft_on_transfer(
            "alice.testnet".parse().unwrap(),
            U128(100000),
            r#"{"kind":"Sponsor","entity_id":"mira"}"#.into(),
        );
        assert_eq!(w.get_entity("mira".into()).unwrap().treasury.0, 100000);
        setup("worker.testnet", 0);
        w.settle_batch(
            1,
            "a".repeat(64),
            vec![Movement {
                from: "mira".into(),
                to: "bakery".into(),
                amount: U128(70000),
            }],
        );
        w.settle_batch(1, "a".repeat(64), vec![]);
        assert_eq!(w.get_entity("mira".into()).unwrap().treasury.0, 30000);
        setup("alice.testnet", 1);
        w.list_asset("mira".into(), U128(150000));
        setup("eco.econia.testnet", 0);
        w.ft_on_transfer(
            "bob.testnet".parse().unwrap(),
            U128(150000),
            r#"{"kind":"Buy","entity_id":"mira"}"#.into(),
        );
        assert_eq!(
            w.nft_token("mira".into()).unwrap().owner_id.as_str(),
            "bob.testnet"
        );
        assert_eq!(w.get_entity("mira".into()).unwrap().treasury.0, 30000);
        assert_eq!(w.get_entity("mira".into()).unwrap().sponsored.0, 100000);
        assert_eq!(w.wallet_balance("alice.testnet".parse().unwrap()).0, 150000);
        assert_eq!(w.escrow_total, 250000);
    }
    #[test]
    fn nft_transfer_preserves_entity_link() {
        let mut w = fixture();
        setup("alice.testnet", 1);
        w.nft_transfer("bob.testnet".parse().unwrap(), "mira".into(), None, None);
        assert_eq!(w.nft_token("mira".into()).unwrap().token_id, "mira");
        assert_eq!(w.get_entity("mira".into()).unwrap().provenance, "genesis");
    }
    #[test]
    fn marketplace_approval_transfers_treasury_with_agent_and_clears_authority() {
        let mut w = fixture();
        setup("eco.econia.testnet", 0);
        w.ft_on_transfer(
            "alice.testnet".parse().unwrap(),
            U128(100000),
            r#"{"kind":"Sponsor","entity_id":"mira"}"#.into(),
        );
        setup("alice.testnet", 10u128.pow(23));
        w.nft_approve("mira".into(), "market.testnet".parse().unwrap(), None);
        let approval = w
            .nft_token("mira".into())
            .unwrap()
            .approved_account_ids
            .unwrap()[&"market.testnet".parse::<AccountId>().unwrap()];
        assert!(w.nft_is_approved(
            "mira".into(),
            "market.testnet".parse().unwrap(),
            Some(approval)
        ));
        setup("market.testnet", 1);
        w.nft_transfer(
            "bob.testnet".parse().unwrap(),
            "mira".into(),
            Some(approval),
            None,
        );
        assert_eq!(
            w.nft_token("mira".into()).unwrap().owner_id.as_str(),
            "bob.testnet"
        );
        assert_eq!(w.get_entity("mira".into()).unwrap().treasury.0, 100000);
        assert_eq!(w.get_entity("mira".into()).unwrap().sponsored.0, 100000);
        assert!(!w.nft_is_approved("mira".into(), "market.testnet".parse().unwrap(), None));
        assert_eq!(w.wallet_balance("alice.testnet".parse().unwrap()).0, 0);
    }
    #[test]
    #[should_panic(expected = "ECO contract only")]
    fn forged_sponsorship_rejected() {
        let mut w = fixture();
        setup("attacker.testnet", 0);
        w.ft_on_transfer(
            "alice.testnet".parse().unwrap(),
            U128(999999),
            r#"{"kind":"Sponsor","entity_id":"mira"}"#.into(),
        );
    }
    #[test]
    #[should_panic(expected = "Operator only")]
    fn untrusted_agent_cannot_settle() {
        let mut w = fixture();
        setup("alice.testnet", 0);
        w.settle_batch(1, "a".repeat(64), vec![]);
    }
    #[test]
    fn escrowed_offer_can_be_cancelled_or_accepted() {
        let mut w = fixture();
        setup("alice.testnet", 1);
        w.list_asset("mira".into(), U128(200000));
        setup("eco.econia.testnet", 0);
        let _ = w.ft_on_transfer(
            "bob.testnet".parse().unwrap(),
            U128(100000),
            r#"{"kind":"Offer","entity_id":"mira"}"#.into(),
        );
        assert_eq!(w.wallet_balance("bob.testnet".parse().unwrap()).0, 0);
        setup("bob.testnet", 1);
        w.cancel_offer("mira".into());
        assert_eq!(w.wallet_balance("bob.testnet".parse().unwrap()).0, 100000);
        setup("eco.econia.testnet", 0);
        let _ = w.ft_on_transfer(
            "bob.testnet".parse().unwrap(),
            U128(150000),
            r#"{"kind":"Offer","entity_id":"mira"}"#.into(),
        );
        setup("alice.testnet", 1);
        w.accept_offer("mira".into(), "bob.testnet".parse().unwrap());
        assert_eq!(
            w.nft_token("mira".into()).unwrap().owner_id.as_str(),
            "bob.testnet"
        );
        assert_eq!(w.wallet_balance("alice.testnet".parse().unwrap()).0, 150000);
        assert_eq!(w.escrow_total, 250000);
    }
}
