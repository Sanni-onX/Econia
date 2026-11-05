use near_contract_standards::fungible_token::{
    core::FungibleTokenCore,
    metadata::{FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC},
    resolver::FungibleTokenResolver,
    FungibleToken,
};
use near_contract_standards::storage_management::{
    StorageBalance, StorageBalanceBounds, StorageManagement,
};
use near_sdk::json_types::U128;
use near_sdk::{env, near, AccountId, NearToken, PanicOnDefault, PromiseOrValue};

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct EcoToken {
    token: FungibleToken,
    owner: AccountId,
}

#[near]
impl EcoToken {
    #[init]
    pub fn new(owner_id: AccountId, total_supply: U128) -> Self {
        assert!(
            env::current_account_id().as_str().ends_with(".testnet"),
            "Testnet only"
        );
        assert!(
            total_supply.0 > 0 && total_supply.0 <= 1_000_000_000_000,
            "Supply bounds"
        );
        let mut token = FungibleToken::new(b"f".to_vec());
        token.internal_register_account(&owner_id);
        token.internal_deposit(&owner_id, total_supply.0);
        Self {
            token,
            owner: owner_id,
        }
    }
    // A fixed genesis supply, distributed from the owner. There is no unrestricted faucet mint.
    pub fn owner(&self) -> AccountId {
        self.owner.clone()
    }
    /// Finite test distribution: 250 ECO once per account, at most 500 claims.
    /// Distributed from existing owner supply; never mints additional ECO.
    #[payable]
    pub fn claim_test_eco(&mut self) {
        let account = env::predecessor_account_id();
        assert!(
            account != self.owner,
            "Owner already holds the test distribution"
        );
        let mut claimed = near_sdk::collections::LookupMap::<AccountId, bool>::new(b"xc".to_vec());
        assert!(!claimed.get(&account).unwrap_or(false), "Already claimed");
        let count = env::storage_read(b"x-faucet-count-v1")
            .map(|v| u32::from_le_bytes(v.try_into().expect("Invalid counter")))
            .unwrap_or(0);
        assert!(count < 500, "Test distribution exhausted");
        let start = env::storage_usage();
        if (self.token.storage_balance_of(account.clone()).is_none()) {
            self.token.internal_register_account(&account);
        }
        self.token.internal_transfer(
            &self.owner,
            &account,
            250_000,
            Some("Econia test distribution".into()),
        );
        claimed.insert(&account, &true);
        env::storage_write(b"x-faucet-count-v1", &(count + 1).to_le_bytes());
        let cost =
            env::storage_byte_cost().as_yoctonear() * u128::from(env::storage_usage() - start);
        let attached = env::attached_deposit().as_yoctonear();
        assert!(attached >= cost, "Insufficient faucet storage deposit");
        if attached > cost {
            near_sdk::Promise::new(account)
                .transfer(NearToken::from_yoctonear(attached - cost))
                .detach();
        }
    }
    pub fn faucet_claimed(&self, account_id: AccountId) -> bool {
        near_sdk::collections::LookupMap::<AccountId, bool>::new(b"xc".to_vec())
            .get(&account_id)
            .unwrap_or(false)
    }
}
#[near]
impl FungibleTokenCore for EcoToken {
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        self.token.ft_transfer(receiver_id, amount, memo)
    }
    #[payable]
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128> {
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }
    fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }
    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }
}
#[near]
impl FungibleTokenResolver for EcoToken {
    #[private]
    fn ft_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
    ) -> U128 {
        self.token
            .internal_ft_resolve_transfer(&sender_id, receiver_id, amount)
            .0
            .into()
    }
}
#[near]
impl StorageManagement for EcoToken {
    #[payable]
    fn storage_deposit(
        &mut self,
        account_id: Option<AccountId>,
        registration_only: Option<bool>,
    ) -> StorageBalance {
        self.token.storage_deposit(account_id, registration_only)
    }
    #[payable]
    fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance {
        self.token.storage_withdraw(amount)
    }
    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        self.token.storage_unregister(force)
    }
    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.token.storage_balance_bounds()
    }
    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.token.storage_balance_of(account_id)
    }
}
#[near]
impl FungibleTokenMetadataProvider for EcoToken {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        FungibleTokenMetadata {
            spec: FT_METADATA_SPEC.into(),
            name: "Econia Test ECO".into(),
            symbol: "ECO".into(),
            decimals: 3,
            icon: None,
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
            .current_account_id("eco.econia.testnet".parse().unwrap())
            .predecessor_account_id(who.parse().unwrap())
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .build());
    }
    #[test]
    fn fixed_supply_transfers_use_registered_storage() {
        setup("owner.testnet", 0);
        let mut c = EcoToken::new("owner.testnet".parse().unwrap(), U128(1_000_000));
        setup("alice.testnet", 10u128.pow(23));
        c.storage_deposit(None, Some(true));
        setup("owner.testnet", 1);
        c.ft_transfer("alice.testnet".parse().unwrap(), U128(100_000), None);
        assert_eq!(c.ft_balance_of("alice.testnet".parse().unwrap()).0, 100_000);
        assert_eq!(c.ft_balance_of("owner.testnet".parse().unwrap()).0, 900_000);
        assert_eq!(c.ft_total_supply().0, 1_000_000);
        assert_eq!(c.ft_metadata().decimals, 3);
    }
    #[test]
    fn finite_faucet_distributes_existing_supply() {
        setup("owner.testnet", 0);
        let mut c = EcoToken::new("owner.testnet".parse().unwrap(), U128(1_000_000));
        setup("alice.testnet", 10u128.pow(22));
        c.claim_test_eco();
        assert_eq!(c.ft_balance_of("alice.testnet".parse().unwrap()).0, 250000);
        assert_eq!(c.ft_total_supply().0, 1_000_000);
        assert!(c.faucet_claimed("alice.testnet".parse().unwrap()));
    }
}
