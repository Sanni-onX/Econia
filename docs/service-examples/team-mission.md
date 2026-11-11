# Econia team mission

Prepare a factual Econia project review: inspect the project account and contract, verify Mira NFT ownership, and reconcile the wrapped NEAR balance. Delegate each supplied target to the appropriate specialist and combine their evidence.

## Coordination

Coordinator plan for the factual Econia review. Budget: maxAiCalls=1 is consumed by this planning call, so only zero-cost specialist delegations are used; no source-brief or copy-edit calls. The four targets are independent, so each is delegated once to its matching specialist with no overlap: account inspection, contract inspection, Mira NFT ownership verification, and wrap.near balance reconciliation. The assembler automatically combines all outputs into the final review; no assembly step is

## Specialist 1: near-account

Agent: person_110. Task: a4f0d78b-db49-4010-9856-791123c8f45e. Source SHA-256: 6252be0771c3967126cb9a88ca517f55c93275cc590e8623169ee890e9575936. Artifact SHA-256: 684f0e24e21fcb741d5b975fb6bcdaa64394018bf86274c4eb66f2de6e0fecfe.

# NEAR account analyst

Finalized NEAR mainnet snapshot.

```json
{
  "network": "mainnet",
  "service": "near-account",
  "blockHeight": 224066468,
  "blockHash": "5xGmC65JPnyRBXqXpjucXdXLFCAzAj2qSRh3P426a4Qu",
  "generatedAt": "2026-11-11T12:39:19.897Z",
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

Agent: person_111. Task: 85b0614c-e283-4e07-bcc2-96a567215626. Source SHA-256: 6252be0771c3967126cb9a88ca517f55c93275cc590e8623169ee890e9575936. Artifact SHA-256: 4bfa3c3730a5279cf9e8c1c1ab26fe0be2a6cfb6cf3c645a87b9d0fbf2439bfb.

# Contract interface inspector

Finalized NEAR mainnet snapshot.

```json
{
  "network": "mainnet",
  "service": "near-contract",
  "blockHeight": 224066465,
  "blockHash": "4bF6vknCkwaE5Pyqx3GrRBPYj79haduNpruzhuz7tiTv",
  "generatedAt": "2026-11-11T12:39:18.081Z",
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

Agent: person_112. Task: 9747e424-55f3-45a0-9ad8-6b50fa75f9bb. Source SHA-256: 765e79683c531b23c142aa2a80ecbe41742bc6e54fde5a654ff5b4f6c2273341. Artifact SHA-256: a60bfa268e16e7e000b4ebeac8c1154228ad8f568f3d05f24b477258cbe7d4b6.

# NFT ownership verifier

Finalized NEAR mainnet snapshot.

```json
{
  "network": "mainnet",
  "service": "near-nft",
  "blockHeight": 224066462,
  "blockHash": "NcwnWvNCy9jkvHNbAfdogX5oNFnTwVGdSzvf4g97uTJ",
  "generatedAt": "2026-11-11T12:39:16.196Z",
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

Agent: person_113. Task: c7ac8252-b406-4d73-9b01-43e330d77b62. Source SHA-256: cc94c77cddba5eaac402ce80e927a492e06723ae8fe4ff8ca27a5a161d073b80. Artifact SHA-256: d4fc725b0a37ed1b8f4863224db678e77ee251ad6516cee177a70bf7b00757c7.

# Token balance verifier

Finalized NEAR mainnet snapshot.

```json
{
  "network": "mainnet",
  "service": "near-token",
  "blockHeight": 224066459,
  "blockHash": "5AGpX2KBqvHLvrCuMbgb5BB86PzS3R3bPzmTJn1tzxtf",
  "generatedAt": "2026-11-11T12:39:14.717Z",
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
