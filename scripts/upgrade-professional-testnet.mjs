import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Account,JsonRpcProvider,actions,baseEncode} from 'near-api-js';
const reviewed='5d25fb5adb8823f8dc2b1c36ca5524d3d3661402f16a4f25e7df62e04654a217';
if(!process.argv.includes('--testnet'))throw Error('Explicit testnet upgrade required');
const wallet=JSON.parse(readFileSync('.private/econia-2-testnet-wallet.json','utf8'));
const evidencePath='docs/professional-testnet-deployment.json',e=JSON.parse(readFileSync(evidencePath,'utf8'));
if(wallet.network!=='testnet'||wallet.accountId!==e.contract||!wallet.accountId.endsWith('.testnet'))throw Error('Testnet identity mismatch');
const provider=new JsonRpcProvider({url:process.env.NEAR_TESTNET_RPC_URL||'https://test.rpc.fastnear.com'});
if(await provider.getNetworkId()!=='testnet')throw Error('RPC mismatch');
const wasm=readFileSync('packages/contracts/target/wasm32-unknown-unknown/release/econia_professional_world.wasm');
if(createHash('sha256').update(wasm).digest('hex')!==reviewed)throw Error('Artifact differs from tested owner-binding upgrade');
const before=await provider.viewAccount({accountId:wallet.accountId,blockQuery:{finality:'final'}});
const priorCode=baseEncode(Buffer.from(e.wasmSha256,'hex'));
if(before.code_hash!==priorCode&&before.code_hash!==baseEncode(Buffer.from(reviewed,'hex')))throw Error('Unexpected deployed code; upgrade refused');
if(before.code_hash!==baseEncode(Buffer.from(reviewed,'hex'))){
 const account=new Account(wallet.accountId,provider,wallet.secretKey);
 const tx=await account.signAndSendTransaction({receiverId:wallet.accountId,actions:[actions.deployContract(wasm)],waitUntil:'FINAL'});
 if(!Object.hasOwn(tx.status||{},'SuccessValue'))throw Error('Upgrade failed');
 (e.upgrades||=[]).push({previousSha256:e.wasmSha256,wasmSha256:reviewed,hash:tx.transaction.hash,reason:'Bind autonomous funding and operator acceptance to the expected current NFT owner. No persistent-state format changed.',verifiedAt:new Date().toISOString()});
 e.wasmSha256=reviewed;writeFileSync(evidencePath,JSON.stringify(e,null,2)+'\n');
 console.log(JSON.stringify({network:'testnet',contract:wallet.accountId,upgradeHash:tx.transaction.hash}));
}
const state=await provider.viewAccount({accountId:wallet.accountId,blockQuery:{finality:'final'}});
if(state.code_hash!==baseEncode(Buffer.from(reviewed,'hex')))throw Error('Deployed code hash mismatch');
console.log(JSON.stringify({verified:true,wasmSha256:reviewed}));
