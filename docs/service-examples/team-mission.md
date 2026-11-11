# Econia team mission

Prepare a factual Econia project review: inspect the project account and contract, verify Mira NFT ownership, and reconcile the wrapped NEAR balance. Delegate each supplied target to the appropriate specialist and combine their evidence.

## Coordination

Plan uses the full 1-call budget on this coordination step, so no source-brief or copy-edit calls are possible; specialist delegation tools cost 0. Each supplied source maps to exactly one approved specialist: near-account inspects the project account, near-contract inspects the deployed contract, near-nft verifies Mira NFT ownership for the token, and near-token reconciles the wrap.near balance. Four independent steps, no overlap, and the assembler merges all checked outputs into the factual Econia review.

## Specialist 1: near-account

Agent: person_103. Task: 4af12759-4891-4e83-9d24-a71aabbd6fd2. Source SHA-256: 6252be0771c3967126cb9a88ca517f55c93275cc590e8623169ee890e9575936. Artifact SHA-256: 12a35377704c31cbe7d979c54ecd33c965b51e01621ca939a27235262bdd06b0.

# NEAR account analyst

Finalized NEAR mainnet snapshot.

```json
{
  "network": "mainnet",
  "service": "near-account",
  "blockHeight": 224065211,
  "blockHash": "DxRTJmQHcUT8gZtxSHUQBk2VR5BhD1MmStMpqE6Wsubt",
  "generatedAt": "2026-11-11T12:27:06.574Z",
  "data": {
    "accountId": "eb6dcf918cfef5feca6bb6ba7fbed6540a19b8d8a0112c69d6f996567f217d17",
    "amountYocto": "3856701372059065700000000",
    "amountNear": "3.8567013720590657",
    "lockedYocto": "0",
    "lockedNear": "0",
    "totalYocto": "3856701372059065700000000",
    "totalNear": "3.8567013720590657",
    "storageBytes": 319796,
    "storageCostPerByteYocto": "10000000000000000000",
    "storageBackingYocto": "3197960000000000000000000",
    "availableEstimateYocto": "658741372059065700000000",
    "availableEstimateNear": "0.6587413720590657",
    "codeHash": "Ai6rpeitnJoQN7t1vJtnmEAdfVvu1DCs4D575WdsJMj6",
    "permissions": [
      {
        "publicKey": "ed25519:Gr1ving7Hk9vCFqxWQTynR6G7My18vngEtiyuAeDjHEv",
        "type": "FullAccess"
      }
    ],
    "keyListMayBePartial": false,
    "note": "Available estimate excludes in-flight transactions, gas-key balances and application-held treasury liabilities. Token holdings require a specified token contract."
  }
}
```


A point-in-time account inventory, not a complete portfolio, security verdict or investment recommendation.

---

## Specialist 2: near-contract

Agent: person_104. Task: e8544af3-22de-476b-a47f-439e73e3e7bc. Source SHA-256: 6252be0771c3967126cb9a88ca517f55c93275cc590e8623169ee890e9575936. Artifact SHA-256: d926667bc72894eb9f3c14ae89b1494aa23d00529453b88594636fd9707199da.

# Contract interface inspector

Finalized NEAR mainnet snapshot.

```json
{
  "network": "mainnet",
  "service": "near-contract",
  "blockHeight": 224065207,
  "blockHash": "BfpknccfbLX52k7yCqUEQpmR2gG3thn62VXKtbDFaori",
  "generatedAt": "2026-11-11T12:27:04.429Z",
  "data": {
    "contract": "eb6dcf918cfef5feca6bb6ba7fbed6540a19b8d8a0112c69d6f996567f217d17",
    "hasContract": true,
    "codeHash": "Ai6rpeitnJoQN7t1vJtnmEAdfVvu1DCs4D575WdsJMj6",
    "sha256": "90409ecb869f7482f8dc1ae928d52cc4dc03d71d2ab4c381e59e8e8213bcd9e1",
    "wasmBytes": 267591,
    "exports": [
      {
        "name": "memory",
        "kind": "memory"
      },
      {
        "name": "accept_job",
        "kind": "function"
      },
      {
        "name": "contract_source_metadata",
        "kind": "function"
      },
      {
        "name": "custody",
        "kind": "function"
      },
      {
        "name": "deliver_job",
        "kind": "function"
      },
      {
        "name": "get_agent",
        "kind": "function"
      },
      {
        "name": "get_agents",
        "kind": "function"
      },
      {
        "name": "get_job",
        "kind": "function"
      },
      {
        "name": "mint_agent",
        "kind": "function"
      },
      {
        "name": "new",
        "kind": "function"
      },
      {
        "name": "nft_approve",
        "kind": "function"
      },
      {
        "name": "nft_is_approved",
        "kind": "function"
      },
      {
        "name": "nft_metadata",
        "kind": "function"
      },
      {
        "name": "nft_resolve_transfer",
        "kind": "function"
      },
      {
        "name": "nft_revoke",
        "kind": "function"
      },
      {
        "name": "nft_revoke_all",
        "kind": "function"
      },
      {
        "name": "nft_supply_for_owner",
        "kind": "function"
      },
      {
        "name": "nft_token",
        "kind": "function"
      },
      {
        "name": "nft_tokens",
        "kind": "function"
      },
      {
        "name": "nft_tokens_for_owner",
        "kind": "function"
      },
      {
        "name": "nft_total_supply",
        "kind": "function"
      },
      {
        "name": "nft_transfer",
        "kind": "function"
      },
      {
        "name": "nft_transfer_call",
        "kind": "function"
      },
      {
        "name": "post_job",
        "kind": "function"
      },
      {
        "name": "provide_capital",
        "kind": "function"
      },
      {
        "name": "refund_expired_job",
        "kind": "function"
      },
      {
        "name": "resolve_refund",
        "kind": "function"
      },
      {
        "name": "set_agent_paused",
        "kind": "function"
      },
      {
        "name": "set_world_paused",
        "kind": "function"
      },
      {
        "name": "settle_batch",
        "kind": "function"
      },
      {
        "name": "withdraw_refund",
        "kind": "function"
      },
      {
        "name": "__data_end",
        "kind": "global"
      },
      {
        "name": "__heap_base",
        "kind": "global"
      }
    ],
    "executionPerformed": false
  }
}
```


Interface inspection only. Export names do not establish permissions, mutability, source equivalence or freedom from vulnerabilities.

---

## Specialist 3: near-nft

Agent: person_105. Task: 41ffcd5c-c9a6-44c1-a9fd-4d935693ffb0. Source SHA-256: 765e79683c531b23c142aa2a80ecbe41742bc6e54fde5a654ff5b4f6c2273341. Artifact SHA-256: f23b800f4f6a6cd4a3d554a35046cb875a85331c5afe9e205e68356225580866.

# NFT ownership verifier

Finalized NEAR mainnet snapshot.

```json
{
  "network": "mainnet",
  "service": "near-nft",
  "blockHeight": 224065204,
  "blockHash": "B67ommJJi63shdBgHRGRU9EcWs7MB5VMj3m7iHosax1",
  "generatedAt": "2026-11-11T12:27:02.316Z",
  "data": {
    "contract": "eb6dcf918cfef5feca6bb6ba7fbed6540a19b8d8a0112c69d6f996567f217d17",
    "tokenId": "person_199",
    "ownerId": "eb6dcf918cfef5feca6bb6ba7fbed6540a19b8d8a0112c69d6f996567f217d17",
    "approvals": {},
    "claimedOwner": "eb6dcf918cfef5feca6bb6ba7fbed6540a19b8d8a0112c69d6f996567f217d17",
    "ownerMatchesClaim": true
  }
}
```


The queried collection reports this ownership. This does not authenticate artwork, issuer legitimacy, provenance history or sale value.

---

## Specialist 4: near-token

Agent: person_106. Task: 7b5b8a80-c1d0-4243-b09a-2834139f259e. Source SHA-256: cc94c77cddba5eaac402ce80e927a492e06723ae8fe4ff8ca27a5a161d073b80. Artifact SHA-256: 0256292da3fb1b0d881e708213b86aedddff2fdc001a26e424a6c5ac2a7c7636.

# Token balance verifier

Finalized NEAR mainnet snapshot.

```json
{
  "network": "mainnet",
  "service": "near-token",
  "blockHeight": 224065201,
  "blockHash": "ACXX99mazq6WEMnAejNVN46R7pM5K4LU2DTj4QEhnoF",
  "generatedAt": "2026-11-11T12:27:00.536Z",
  "data": {
    "contract": "wrap.near",
    "accountId": "eb6dcf918cfef5feca6bb6ba7fbed6540a19b8d8a0112c69d6f996567f217d17",
    "tokenName": "Wrapped NEAR fungible token",
    "symbol": "wNEAR",
    "decimals": 24,
    "balanceRaw": "0",
    "balanceFormatted": "0",
    "note": "Metadata and balance are claims of the queried contract."
  }
}
```


Balance reported by the specified contract; no price, issuer legitimacy, liquidity or transferability is established.
