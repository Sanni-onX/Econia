import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {generateSeedPhrase} from 'near-seed-phrase';
import {Account,JsonRpcProvider,actions,teraToGas,KeyPair} from 'near-api-js';
import {signMessage} from 'near-api-js/nep413';
import {openAgentStore} from '../packages/agent-runtime/store.mjs';
import {createProfessionalApplication} from '../apps/api/professional-server.mjs';
import {createProfessionalTestnet} from '../packages/near/professional-testnet.mjs';
if(!process.argv.includes('--testnet'))throw Error('This commissioning script requires --testnet');
const wallet=JSON.parse(readFileSync('.private/econia-2-testnet-wallet.json','utf8'));
if(wallet.network!=='testnet'||!wallet.accountId.endsWith('.testnet'))throw Error('Testnet only');
const provider=new JsonRpcProvider({url:process.env.NEAR_TESTNET_RPC_URL||'https://test.rpc.fastnear.com'});
if(await provider.getNetworkId()!=='testnet')throw Error('RPC network mismatch');
const parent=new Account(wallet.accountId,provider,wallet.secretKey);
const clientPath='.private/econia-2-demo-client.json';let clientWallet;
if(existsSync(clientPath))clientWallet=JSON.parse(readFileSync(clientPath,'utf8'));
else{clientWallet={network:'testnet',accountId:'client.'+wallet.accountId,...generateSeedPhrase(randomBytes(32))};writeFileSync(clientPath,JSON.stringify(clientWallet,null,2),{flag:'wx',mode:0o600});}
if(clientWallet.network!=='testnet'||clientWallet.accountId!=='client.'+wallet.accountId)throw Error('Commissioning client mismatch');
try{await provider.viewAccount({accountId:clientWallet.accountId,blockQuery:{finality:'final'}});}catch(e){if(!/does not exist|UNKNOWN_ACCOUNT/i.test(e.message))throw e;const result=await parent.signAndSendTransaction({receiverId:clientWallet.accountId,actions:[actions.createAccount(),actions.transfer(5n*10n**23n),actions.addFullAccessKey(KeyPair.fromString(clientWallet.secretKey).getPublicKey())],waitUntil:'FINAL'});if(!Object.hasOwn(result.status||{},'SuccessValue'))throw Error('Testnet client creation failed');}
const client=new Account(clientWallet.accountId,provider,clientWallet.secretKey);
const chain=await createProfessionalTestnet({contract:wallet.accountId,operatorKey:wallet.operatorSecretKey,provider});
const store=openAgentStore({path:'.data/professional-service-commissioning.sqlite'});
const app=await createProfessionalApplication({store,provider,contract:wallet.accountId,settlement:chain});
await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;let token;
const api=async(path,body)=>{const r=await fetch(base+'/api/society/'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const value=await r.json();if(!r.ok)throw Error(value.error||'API error');return value;};
const transactions=[];
async function signPrepared(tx,method){
 if(tx.receiverId!==wallet.accountId||tx.actions?.length!==1||tx.actions[0].type!=='FunctionCall'||tx.actions[0].params.methodName!==method||BigInt(tx.actions[0].params.deposit)>15n*10n**22n)throw Error('Commissioning transaction exceeds reviewed testnet scope');
 const p=tx.actions[0].params;
 const result=await client.signAndSendTransaction({receiverId:tx.receiverId,actions:[actions.functionCall(p.methodName,p.args,BigInt(p.gas),BigInt(p.deposit))],waitUntil:'FINAL'});
 if(!Object.hasOwn(result.status||{},'SuccessValue'))throw Error('Testnet transaction failed');
 transactions.push({method,hash:result.transaction.hash});console.log(JSON.stringify({method,hash:result.transaction.hash}));return result.transaction.hash;
}
async function drain(){for(let i=0;i<8;i++){await app.runtime.settle();if(!app.runtime.jobs().some(j=>['QUEUED','RUNNING'].includes(j.state)))return;}throw Error('Commissioning queue did not settle');}
try{
 const supply=await provider.callFunction({contractId:wallet.accountId,method:'nft_supply_for_owner',args:{account_id:clientWallet.accountId},blockQuery:{finality:'final'}});if(supply!=='0')throw Error('Ordinary commissioning client must own no agent NFT');
 const challenge=await api('auth/challenge',{accountId:clientWallet.accountId});
 const signed=await signMessage({signerAccount:client,payload:{message:challenge.message,recipient:challenge.recipient,nonce:Buffer.from(challenge.nonce,'base64')}});
 const session=await api('auth/login',{challengeId:challenge.id,accountId:clientWallet.accountId,publicKey:clientWallet.publicKey,signature:Buffer.from(signed.signature).toString('base64')});token=session.token;
 const c=await api('conversations',{agentId:'person_042',kind:'CLIENT'});
 const brief='Please issue a scoped proposal now for a small, self-contained static website for Hearth & Grain, a neighborhood catering business. All copy is supplied here: Seasonal catering for neighborhood gatherings; menu planning and procurement comparisons; customers first share their guest count, event date and dietary constraints. The business has no published email, order form or address yet, so do not invent those. Use three sections: About, Catering Services, and How It Works. Choose a restrained brand accent. No collaborator is needed for this small task; do not request quotations or hire anyone. Static HTML/CSS only, no scripts, remote assets, payments, checkout or claims of physical fulfillment.';
 await api('conversations/'+c.id+'/messages',{content:brief,requestId:'live-website-'+randomUUID()});await drain();
 const thread=await api('conversations/'+c.id);const p=thread.proposals.find(p=>p.service_id==='website-build');if(!p)throw Error('Professional did not offer a supported website proposal');
 const funding=await api('proposals/'+p.id+'/funding',{});const fundingHash=await signPrepared(funding,'post_service_job');const funded=await api('proposals/'+p.id+'/confirm-funding',{transactionHash:fundingHash});await drain();
 const contract=await api('contracts/'+funded.id);if(contract.state!=='REVIEW_READY')throw Error('Checked deliverable did not complete: '+JSON.stringify(app.runtime.jobs().map(j=>({state:j.state,error:j.error}))));
 const files=await api('contracts/'+funded.id+'/artifacts');if(!files.length)throw Error('No persisted files');const contents=[];
 for(const f of files){const r=await fetch(base+'/api/society/artifacts/'+f.id,{headers:{Authorization:'Bearer '+token}});const content=await r.text();if(!r.ok||createHash('sha256').update(content).digest('hex')!==f.sha256)throw Error('Artifact download hash mismatch');contents.push({...f,content});}
 const acceptance=await api('contracts/'+funded.id+'/acceptance',{});const acceptanceHash=await signPrepared(acceptance,'accept_service_job');const accepted=await api('contracts/'+funded.id+'/confirm-acceptance',{transactionHash:acceptanceHash});
 const liveJob=await chain.view('get_service_job',{job_id:Number(contract.chain_job_id)});if(accepted.state!=='SETTLED'||liveJob.state!=='SETTLED')throw Error('Settlement did not reconcile');
 const report={verified:true,verifiedAt:store.now(),scope:'A real NEP-413-authenticated testnet client with no NFTs commissioned a professional website, funded exact escrow, received a checked downloadable HTML artifact and accepted actual testnet settlement. API credentials and signing keys remain private.',client:clientWallet.accountId,nftCount:supply,provider:p.provider_id,proposal:p,contract:accepted,transactions,artifacts:contents.map(({content,...f})=>f),onchainJob:liveJob,ledger:store.db.prepare('SELECT * FROM ledger_transfers WHERE receipt_hash IN (?,?)').all(fundingHash,acceptanceHash)};
 mkdirSync('docs/service-examples',{recursive:true});for(const f of contents)writeFileSync('docs/service-examples/professional-'+f.filename,f.content);
 writeFileSync('docs/professional-service-verification.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({verified:true,clientOwnsNfts:false,contractState:accepted.state,files:files.map(f=>f.filename)}));
}finally{await app.close();store.close();}
