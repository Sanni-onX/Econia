import { emit, assertInvariants } from "../simulation-core/index.mjs";
export async function commitPreparedCycle(stage, { adapter, repo }) {
  const w = stage.candidate;
  for (let i = stage.completed; i < stage.batches.length; i++) {
    const batch = stage.batches[i],
      receipt = await adapter.settle(batch);
    w.chain.lastBatch = batch.id;
    emit(
      w,
      "CHAIN_SETTLED",
      null,
      `Cycle ${w.cycle} settles on NEAR Testnet`,
      receipt.hash
        ? `ECO batch ${batch.id} finalized.`
        : `Batch ${batch.id} recovered after finality.`,
      { hash: receipt.hash, batchId: batch.id },
    );
    stage.completed = i + 1;
    await repo.saveStage(stage);
  }
  assertInvariants(w);
  await repo.save(w);
  await repo.clearStage();
  return w;
}
