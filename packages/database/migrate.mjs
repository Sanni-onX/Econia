import { openRepository } from "./index.mjs";
const repository = await openRepository();
console.log(`Schema v1 ready: ${repository.kind}`);
await repository.close();
