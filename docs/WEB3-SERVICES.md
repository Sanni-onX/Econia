# NEAR Web3 service workers

Four additional NFT identities now have real Web3 tools. The workforce has seven activated capabilities in total, with 57 identities left idle. Every Web3 task is read-only and uses **zero AI inference requests**. These services are available through the existing signed-wallet task workspace and Railway worker.

| Identity | Worker | Useful deliverable | Input |
| --- | --- | --- | --- |
| Ren #103 | NEAR account analyst | Native balances, storage backing, available-balance estimate and public access-key permission inventory | A mainnet account ID |
| Sana #104 | Contract interface inspector | Verified deployed code hash, binary size and WASM export list | A mainnet contract account ID |
| Leo #105 | NFT ownership verifier | Collection-reported NFT owner, approvals and optional claimed-owner comparison | JSON with `contract`, `tokenId`, optional `claimedOwner` |
| Amara #106 | Token balance verifier | NEP-141 token metadata and the requested account's exact token balance | JSON with `contract` and `accountId` |

## Examples

Account or contract input: `account.near`

NFT input:

```json
{"contract":"collection.near","tokenId":"1","claimedOwner":"owner.near"}
```

Token input:

```json
{"contract":"wrap.near","accountId":"account.near"}
```

These are input templates. Use an existing mainnet account, contract and token ID. The workspace now separates **Web3 services** from **Documents & data**; the owner capability selector includes both groups.

## Tools and output checks

Each task chooses a finalized block, pins its account/contract queries to that block, and rejects replies reporting a different block hash or height. The editor/verifier then runs deterministic provenance and arithmetic checks before releasing a Markdown report. Reports include the block hash, height and exact raw values. They use the same persisted queue, request-id protection, private customer access and explicit trial acceptance as the original services.

Account analysis uses the protocol's storage cost and reconciles `amount + locked - max(locked, storage backing)`. This is an estimate of native account availability, excluding in-flight transactions, gas-key balances and application-held liabilities. Access-key inventory is capped at 100 entries and marked potentially partial at that limit. A function-call key is reported with its receiver, allowed methods and allowance; the report does not classify ordinary full-access keys as a vulnerability.

Contract inspection downloads at most 2 MB of WASM, recomputes its hash and compares it with the account's code hash. It parses export names **without instantiating the module or executing code**. Export names alone do not prove which operations a caller can execute. Global-contract references are not resolved by this version.

NFT verification checks the returned token ID, validates its reported owner and approval records, and compares a claimed owner when supplied. It does not authenticate artwork, issuer legitimacy, provenance history or sale value.

Token verification checks a standard unsigned 128-bit balance and formats amounts without floating-point rounding. Formatting above 38 decimal places is omitted while preserving the raw balance. Metadata and balances are claims of the specified token contract, not proof of value, liquidity or transferability. No prices, swaps or asset movement are performed.

Only the configured mainnet RPC endpoint is used. Task input cannot select arbitrary URLs or RPC hosts. Existing project task limits still apply, but Web3 tasks reserve no AI calls. They require no API model key, transaction signer, gas payment or per-agent capital. Hosting and RPC provider costs remain separate.

## Verified examples

[Live mainnet commissioning evidence](web3-workforce-verification.json) records all four workers producing checked deliverables, with zero inference reservations and no onchain transactions. These are operator commissioning examples, not customer payments or authenticated customer sessions.

- [Account report](service-examples/near-account.md)
- [Contract interface report](service-examples/near-contract.md)
- [NFT ownership report](service-examples/near-nft.md)
- [Token balance report](service-examples/near-token.md)

The current release remains a project-funded trial. Paid NEAR settlement and owner earnings are not enabled by adding these capabilities. See [Railway deployment](RAILWAY-DEPLOYMENT.md).

Protocol references: [NEAR account/contract RPC](https://docs.near.org/api/rpc/contracts), [NEP-171 NFT interface](https://github.com/near/NEPs/blob/master/neps/nep-0171.md), [NEP-141 token interface](https://github.com/near/NEPs/blob/master/neps/nep-0141.md).
