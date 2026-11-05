import {
  Account,
  JsonRpcProvider,
  KeyPair,
  teraToGas,
  nearToYocto,
} from "near-api-js";
import { readFileSync } from "node:fs";
import { NearTestnetEcoAdapter } from "./near.mjs";
import { tick, emit, assertInvariants } from "../simulation-core/index.mjs";
import { transfer } from "../economy/index.mjs";
import { verifyMessage } from "near-api-js/nep413";
import { commitPreparedCycle } from "./settlement.mjs";

export async function createChainRuntime(repo, chain) {
  const operator = process.env.NEAR_OPERATOR_KEY
    ? {
        accountId: process.env.NEAR_OPERATOR_ACCOUNT || chain.owner,
        secretKey: process.env.NEAR_OPERATOR_KEY,
        publicKey: KeyPair.fromString(process.env.NEAR_OPERATOR_KEY)
          .getPublicKey()
          .toString(),
      }
    : JSON.parse(readFileSync(".private/operator.json", "utf8"));
  const provider = new JsonRpcProvider({ url: chain.rpc });
  const permission = await provider.query({
    request_type: "view_access_key",
    finality: "final",
    account_id: operator.accountId,
    public_key: operator.publicKey,
  });
  if (
    permission.permission?.FunctionCall?.receiver_id !== chain.world ||
    permission.permission.FunctionCall.method_names.join(",") !== "settle_batch"
  )
    throw new Error(
      "Operator must have only settle_batch permission for this world",
    );
  const worker = new Account(operator.accountId, provider, operator.secretKey);
  const adapter = new NearTestnetEcoAdapter({
    rpcUrl: chain.rpc,
    ecoContract: chain.eco,
    worldContract: chain.world,
    signer: (tx) =>
      worker.callFunctionRaw({
        contractId: tx.receiverId,
        methodName: tx.methodName,
        args: tx.args,
        gas: BigInt(tx.gas),
        deposit: BigInt(tx.deposit),
        waitUntil: "FINAL",
      }),
  });
  async function finish(stage) {
    const w = stage.candidate;
    for (const id of stage.newEntities) {
      const e = w.entities[id];
      e.owner = chain.owner;
      if (await adapter.entity(id)) continue;
      const wallet = process.env.NEAR_REGISTRAR_KEY
        ? { accountId: chain.owner, secretKey: process.env.NEAR_REGISTRAR_KEY }
        : JSON.parse(readFileSync(".private/near-testnet-wallet.json", "utf8"));
      if (wallet.accountId !== chain.owner)
        throw new Error("Registrar mismatch");
      const registrar = new Account(
        wallet.accountId,
        provider,
        wallet.secretKey,
      );
      await registrar.callFunctionRaw({
        contractId: chain.world,
        methodName: "mint_entity",
        args: {
          entity_id: e.id,
          receiver_id: chain.owner,
          entity_type: e.type,
          name: e.name,
          provenance: `cycle:${w.cycle}`,
        },
        gas: teraToGas("80"),
        deposit: nearToYocto("0.015"),
        waitUntil: "FINAL",
      });
    }
    return commitPreparedCycle(stage, { adapter, repo });
  }
  return {
    adapter,
    async verifyPolicy(challenge, proof, world) {
      await verifyMessage({
        signerAccountId: proof.accountId,
        signerPublicKey: proof.publicKey,
        payload: {
          message: challenge.message,
          recipient: challenge.recipient,
          nonce: Buffer.from(challenge.nonce, "base64"),
        },
        signature: Buffer.from(proof.signature, "base64"),
        provider,
      });
      async function controller(id, seen = new Set()) {
        if (seen.has(id)) throw new Error("Ownership cycle");
        seen.add(id);
        const e = world.entities[id];
        if (e?.type === "BUSINESS") {
          const stake = world.holdings.find(
            (h) => h.entity === id && h.bps > 5000,
          );
          if (stake) return controller(stake.owner, seen);
        }
        return adapter.owner(id);
      }
      if ((await controller(challenge.entityId)) !== proof.accountId)
        throw new Error("Current NFT owner signature required");
    },
    async prepare({ kind, entityId, amount, accountId, buyer }) {
      if (
        typeof accountId !== "string" ||
        !/^[a-z0-9_.-]{2,64}$/.test(accountId)
      )
        throw new Error("Valid testnet account required");
      if (kind === "Faucet") {
        if (
          await adapter.view(chain.eco, "faucet_claimed", {
            account_id: accountId,
          })
        )
          throw new Error("This account already claimed its test ECO.");
        return [
          {
            receiverId: chain.eco,
            actions: [
              {
                type: "FunctionCall",
                params: {
                  methodName: "claim_test_eco",
                  args: {},
                  gas: "50000000000000",
                  deposit: nearToYocto("0.01").toString(),
                },
              },
            ],
          },
        ];
      }
      if (["CancelOffer", "AcceptOffer", "Withdraw"].includes(kind)) {
        if (
          kind === "Withdraw" &&
          (!Number.isSafeInteger(amount) || amount <= 0)
        )
          throw new Error("Invalid withdrawal");
        if (
          kind === "AcceptOffer" &&
          (typeof buyer !== "string" || !/^[a-z0-9_.-]{2,64}$/.test(buyer))
        )
          throw new Error("Invalid buyer");
        return [
          {
            receiverId: chain.world,
            actions: [
              {
                type: "FunctionCall",
                params: {
                  methodName: {
                    CancelOffer: "cancel_offer",
                    AcceptOffer: "accept_offer",
                    Withdraw: "withdraw",
                  }[kind],
                  args:
                    kind === "Withdraw"
                      ? { amount: String(amount) }
                      : {
                          entity_id: entityId,
                          ...(kind === "AcceptOffer" ? { buyer } : {}),
                        },
                  gas: "100000000000000",
                  deposit: "1",
                },
              },
            ],
          },
        ];
      }
      if (!["Sponsor", "Buy", "Offer", "List"].includes(kind))
        throw new Error("Unsupported wallet operation");
      if (!Number.isSafeInteger(amount) || amount < 1000 || amount > 1000000000)
        throw new Error("Invalid amount");
      const entry = await adapter.entity(entityId);
      if (!entry) throw new Error("Entity not onchain");
      if (
        ["Buy", "Offer", "List"].includes(kind) &&
        entry.entity_type !== "PERSON"
      )
        throw new Error(
          "Business equity trading is not enabled; only person Living Assets can be listed.",
        );
      if (kind === "List") {
        if ((await adapter.owner(entityId)) !== accountId)
          throw new Error("NFT owner only");
        return [
          {
            receiverId: chain.world,
            actions: [
              {
                type: "FunctionCall",
                params: {
                  methodName: "list_asset",
                  args: { entity_id: entityId, ask: String(amount) },
                  gas: "50000000000000",
                  deposit: "1",
                },
              },
            ],
          },
        ];
      }
      if (kind === "Sponsor" && (await adapter.owner(entityId)) !== accountId)
        throw new Error("NFT owner only");
      const transactions = [];
      if (
        !(await adapter.view(chain.eco, "storage_balance_of", {
          account_id: accountId,
        }))
      )
        transactions.push({
          receiverId: chain.eco,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "storage_deposit",
                args: { account_id: accountId, registration_only: true },
                gas: "30000000000000",
                deposit: nearToYocto("0.01").toString(),
              },
            },
          ],
        });
      if (
        !(await adapter.view(chain.world, "wallet_registered", {
          account_id: accountId,
        }))
      )
        transactions.push({
          receiverId: chain.world,
          actions: [
            {
              type: "FunctionCall",
              params: {
                methodName: "register_wallet",
                args: {},
                gas: "30000000000000",
                deposit: nearToYocto("0.01").toString(),
              },
            },
          ],
        });
      transactions.push({
        receiverId: chain.eco,
        actions: [
          {
            type: "FunctionCall",
            params: {
              methodName: "ft_transfer_call",
              args: {
                receiver_id: chain.world,
                amount: String(amount),
                msg: JSON.stringify({ kind, entity_id: entityId }),
              },
              gas: "150000000000000",
              deposit: "1",
            },
          },
        ],
      });
      return transactions;
    },
    async market(w, hash, sender) {
      if (w.receipts.includes(hash)) return;
      const events = await adapter.worldEventsReceipt(hash, sender);
      for (const ev of events) {
        if (
          ![
            "asset_listed",
            "asset_sold",
            "offer_created",
            "offer_cancelled",
          ].includes(ev.type)
        )
          continue;
        const e = w.entities[ev.entity_id];
        if (!e) continue;
        e.owner = await adapter.owner(e.id);
        const listing = await adapter.view(chain.world, "get_listing", {
          entity_id: e.id,
        });
        w.listings = w.listings.filter((l) => l.entity !== e.id);
        if (listing)
          w.listings.push({
            id: `chain-listing-${e.id}`,
            entity: e.id,
            seller: listing.seller,
            ask: Number(listing.ask),
            status: "ACTIVE",
            cycle: w.cycle,
          });
        if (ev.type === "asset_sold")
          emit(
            w,
            "NFT_SOLD",
            e.id,
            `${e.name} changes ownership`,
            `${Number(ev.amount) / 1000} test ECO settled on NEAR. Economic identity persists.`,
            { hash, from: ev.seller, to: ev.buyer },
          );
        if (ev.type === "asset_listed")
          emit(
            w,
            "NFT_LISTED",
            e.id,
            `${e.name} is listed on NEAR`,
            `${Number(ev.ask) / 1000} test ECO asking price.`,
            { hash },
          );
        if (ev.type === "offer_created")
          w.offers.push({
            id: hash,
            entity: e.id,
            buyer: sender,
            amount: Number(ev.amount),
            status: "OPEN",
            cycle: w.cycle,
          });
        if (ev.type === "offer_cancelled")
          for (const offer of w.offers)
            if (
              offer.entity === e.id &&
              offer.buyer === sender &&
              offer.status === "OPEN"
            )
              offer.status = "CANCELLED";
        if (ev.type === "asset_sold")
          for (const offer of w.offers)
            if (
              offer.entity === e.id &&
              offer.buyer === ev.buyer &&
              offer.status === "OPEN"
            )
              offer.status = "ACCEPTED";
      }
      w.receipts.push(hash);
    },
    async recover(w) {
      const stage = await repo.loadStage();
      if (stage) return finish(stage);
      return w;
    },
    async advance(w, count = 1) {
      for (let n = 0; n < count; n++) {
        const pending = await repo.loadStage();
        if (pending) {
          w = await finish(pending);
          continue;
        }
        if (w.paused) break;
        const candidate = structuredClone(w),
          knownLedger = new Set(w.ledger.map((l) => l.id));
        tick(candidate);
        const movements = candidate.ledger.filter(
          (l) => !knownLedger.has(l.id),
        );
        const firstId =
          (await adapter.view(chain.world, "settlement_state")).last_batch + 1;
        if (firstId !== w.chain.lastBatch + 1)
          throw new Error(
            "Unexpected onchain settlement sequence; reconcile before progressing",
          );
        const batches = [];
        for (let i = 0; i < Math.max(1, movements.length); i += 50)
          batches.push({
            id: firstId + batches.length,
            transfers: movements.slice(i, i + 50),
          });
        const stage = {
          candidate,
          batches,
          newEntities: Object.keys(candidate.entities).filter(
            (id) => !Object.hasOwn(w.entities, id),
          ),
          completed: 0,
        };
        await repo.saveStage(stage);
        w = await finish(stage);
      }
      return w;
    },
    async sponsor(w, id, hash, sender) {
      if (w.receipts.includes(hash)) return;
      if (
        typeof hash !== "string" ||
        !/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(hash) ||
        typeof sender !== "string"
      )
        throw new Error("Valid transaction hash and sender required");
      const receipt = await adapter.sponsorshipReceipt(hash, sender, id),
        amount = Number(receipt.amount);
      if (!Number.isSafeInteger(amount) || amount < 1)
        throw new Error("Unsupported amount");
      if (!w.entities[id]) throw new Error("Unknown entity");
      if (!w.entities.external_capital)
        w.entities.external_capital = {
          ...structuredClone(w.entities.player),
          id: "external_capital",
          name: "External ECO capital clearing",
          owner: "protocol",
          cash: 0,
          genesisCapital: 0,
          revenue: 0,
          expenses: 0,
          sponsorship: 0,
          inventory: {},
          equipment: [],
          capabilities: ["HOLD_FUNDS"],
        };
      w.entities.external_capital.cash += amount;
      w.supply += amount;
      transfer(
        w,
        "external_capital",
        id,
        amount,
        "Onchain sponsorship",
        `sponsor-${hash}`,
      );
      w.entities[id].sponsorship += amount;
      w.receipts.push(hash);
      w.sponsorships.push({
        id: hash,
        entity: id,
        amount,
        sender,
        hash,
        cycle: w.cycle,
      });
      emit(
        w,
        "ENTITY_FUNDED",
        id,
        `${w.entities[id].name} receives test ECO`,
        `${amount / 1000} ECO received through a finalized NEAR sponsorship.`,
        { hash, amount, sender },
      );
    },
    async reconcile(w) {
      return adapter.reconcile(
        Object.values(w.entities).filter((e) => e.id !== "external_capital"),
      );
    },
  };
}
