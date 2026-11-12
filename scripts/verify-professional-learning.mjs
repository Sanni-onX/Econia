import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Account,JsonRpcProvider,actions} from 'near-api-js';
import {signMessage} from 'near-api-js/nep413';
import {openAgentStore} from '../packages/agent-runtime/store.mjs';
import {createProfessionalRuntime} from '../packages/agent-runtime/runtime.mjs';
import {createProfessionalApplication} from '../apps/api/professional-server.mjs';
import {createProfessionalTestnet} from '../packages/near/professional-testnet.mjs';
if(!process.argv.includes('--testnet'))throw Error('Explicit testnet required');
const deployment=JSON.parse(readFileSync('.private/econia-2-testnet-wallet.json','utf8')),client=JSON.parse(readFileSync('.private/econia-2-demo-client.json','utf8'));
if(deployment.network!=='testnet'||client.network!=='testnet')throw Error('Testnet only');
const provider=new JsonRpcProvider({url:process.env.NEAR_TESTNET_RPC_URL||'https://test.rpc.fastnear.com'},{retries:3,wait:500,backoff:1.5}),account=new Account(client.accountId,provider,client.secretKey);
const path='.data/professional-service-commissioning.sqlite';let store=openAgentStore({path});
const chain=await createProfessionalTestnet({contract:deployment.accountId,operatorKey:deployment.operatorSecretKey,provider,store});
const app=await createProfessionalApplication({store,provider,contract:deployment.accountId,settlement:chain});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));let token;
const base='http://127.0.0.1:'+app.server.address().port,txs=[];
const api=async(path,body)=>{const r=await fetch(base+'/api/society/'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const v=await r.json();if(!r.ok)throw Error(v.error||'API failure');return v;};
async function sign(tx,method){const p=tx.actions?.[0]?.params;if(tx.receiverId!==deployment.accountId||p?.methodName!==method||BigInt(p.deposit)>15n*10n**22n)throw Error('Commissioning scope exceeded');const r=await account.signAndSendTransaction({receiverId:tx.receiverId,actions:[actions.functionCall(method,p.args,BigInt(p.gas),BigInt(p.deposit))],waitUntil:'FINAL'});if(!Object.hasOwn(r.status||{},'SuccessValue'))throw Error('Testnet transaction failed');txs.push({method,hash:r.transaction.hash});return r.transaction.hash;}
const drain=async()=>{for(let n=0;n<8;n++){await app.runtime.settle();if(!app.runtime.jobs().some(j=>['QUEUED','RUNNING'].includes(j.state)))return;}throw Error('Queue did not settle');};
let report;
try{
 if(store.db.prepare('SELECT id FROM evaluations').get())throw Error('Learning evidence already exists; review before another paid request');
 const prior=store.db.prepare("SELECT c.id FROM contracts c JOIN proposals p ON p.id=c.proposal_id WHERE c.state='SETTLED' AND p.provider_id='person_042' AND p.customer_id=? ORDER BY c.rowid LIMIT 1").get(client.accountId);if(!prior)throw Error('Actual prior accepted work is required');
 const before=app.runtime.contracts.requireContract(prior.id,client.accountId),beforeFile=app.runtime.contracts.artifacts(before.id,client.accountId).find(f=>f.filename==='index.html'),beforeHtml=app.runtime.contracts.artifact(beforeFile.id,client.accountId).content,beforeColor=beforeHtml.match(/a\{color:(#[a-f0-9]{6})/i)?.[1];
 const target=beforeColor?.toLowerCase()==='#375e70'?'#30523B':'#375E70';
 const challenge=await api('auth/challenge',{accountId:client.accountId}),signed=await signMessage({signerAccount:account,payload:{message:challenge.message,recipient:challenge.recipient,nonce:Buffer.from(challenge.nonce,'base64')}});
 token=(await api('auth/login',{challengeId:challenge.id,accountId:client.accountId,publicKey:client.publicKey,signature:Buffer.from(signed.signature).toString('base64')})).token;
 const evaluation=await api('contracts/'+before.id+'/feedback',{rating:3,feedback:'For my future Hearth & Grain website work, please use exactly '+target+' as the actual CSS accent color. This is my brand preference after reviewing the previous artifact. Also supply the final visitor-facing About, Catering Services and How It Works copy, rather than instructions for assembling a website. Keep supplied facts and missing-contact constraints unchanged.'});await drain();
 const strategy=app.runtime.memory.strategy('person_042',client.accountId);if(!strategy||!JSON.stringify(strategy).toLowerCase().includes(target.toLowerCase()))throw Error('Actual feedback did not produce a usable client-specific strategy');
 // The customer repeats exactly the previously commissioned scope/input; no new color is inserted into the task.
 const p=app.runtime.contracts.propose({customerId:client.accountId,providerId:before.provider_id,serviceId:before.service_id,scope:before.scope,input:before.input_text,price:before.price});
 const funding=await api('proposals/'+p.id+'/funding',{}),fundingHash=await sign(funding,'post_service_job'),c=await api('proposals/'+p.id+'/confirm-funding',{transactionHash:fundingHash});await drain();
 const done=app.runtime.contracts.requireContract(c.id,client.accountId);if(done.state!=='REVIEW_READY')throw Error('Revised service failed output checks');
 const file=app.runtime.contracts.artifacts(c.id,client.accountId).find(f=>f.filename==='index.html'),html=app.runtime.contracts.artifact(file.id,client.accountId).content,afterColor=html.match(/a\{color:(#[a-f0-9]{6})/i)?.[1];
 if(afterColor?.toLowerCase()!==target.toLowerCase()||beforeColor?.toLowerCase()===afterColor.toLowerCase())throw Error('Subsequent output did not demonstrate the requested changed choice');
 const acceptance=await api('contracts/'+c.id+'/acceptance',{}),acceptanceHash=await sign(acceptance,'accept_service_job');await api('contracts/'+c.id+'/confirm-acceptance',{transactionHash:acceptanceHash});
 report={verified:true,verifiedAt:store.now(),network:'testnet',scope:'Real customer feedback led to a client-private strategy revision, retrieved during a second paid execution with identical scope/input. The actual generated CSS accent changed to the customer preference. This demonstrates persisted memory/strategy adaptation, not model-weight training or a controlled causal evaluation.',customer:client.accountId,provider:'person_042',evaluation,strategy,before:{contractId:before.id,accent:beforeColor,sha256:beforeFile.sha256},after:{contractId:c.id,accent:afterColor,sha256:file.sha256},inputUnchanged:p.input_text===before.input_text&&p.scope===before.scope,transactions:txs,inferenceReservations:store.db.prepare('SELECT count(*) n FROM inference_reservations').get().n};
 writeFileSync('docs/service-examples/learning-index.html',html);writeFileSync('docs/professional-learning-verification.json',JSON.stringify(report,null,2)+'\n');
}finally{await app.close();store.close();}
store=openAgentStore({path});const runtime=createProfessionalRuntime({store,inference:{ready:false}});
try{const beforeCalls=store.db.prepare('SELECT count(*) n FROM inference_reservations').get().n;await runtime.settle();const strategy=runtime.memory.strategy('person_042',client.accountId);if(!strategy||JSON.stringify(strategy)!==JSON.stringify(report.strategy)||store.db.prepare('SELECT count(*) n FROM inference_reservations').get().n!==beforeCalls||runtime.contracts.requireContract(report.after.contractId,client.accountId).state!=='SETTLED')throw Error('Restart verification failed');report.restartVerified=true;report.noInferenceReplayed=true;writeFileSync('docs/professional-learning-verification.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({verified:true,beforeAccent:report.before.accent,afterAccent:report.after.accent,restartVerified:true}));}finally{await runtime.close();store.close();}
