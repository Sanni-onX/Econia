import test from 'node:test';
import assert from 'node:assert/strict';
import {openAgentStore} from '../packages/agent-runtime/store.mjs';
import {createProfessionalRuntime} from '../packages/agent-runtime/runtime.mjs';
import {createVerifiedLedger} from '../packages/agent-runtime/ledger.mjs';
test('Only verified matching receipts fund work and settlement records exact, idempotent transfers',async()=>{
 const s=openAgentStore({path:':memory:'});
 const chain={ready:true,verifyFunding:async({proposal:p,transactionHash,customer})=>({network:'testnet',signer:customer,proposalId:p.id,agentId:p.provider_id,amount:p.price,jobId:'0',hash:transactionHash,contract:'fixture.testnet',blockHeight:1}),verifyAcceptance:async({contract:c,transactionHash,customer})=>({network:'testnet',signer:customer,jobId:c.chain_job_id,hash:transactionHash,contract:'fixture.testnet',blockHeight:2})};
 const runtime=createProfessionalRuntime({store:s,settlement:chain,inference:{ready:false}});
 try{
  const ledger=createVerifiedLedger(s);
  assert.throws(()=>ledger.record({receiptHash:'invented',debit:'wallet:client.testnet',credit:'agent:person_017',amount:'10'}),/verified testnet receipt/);
  const p=runtime.contracts.propose({customerId:'client.testnet',providerId:'person_017',serviceId:'csv-audit',scope:'Compute exact decimal statistics for the supplied operational dataset.',input:'product,amount\nNotebook,0.10\nPen,0.20\nFolder,0.30',price:'5000000000000000000000'});
  const c=await runtime.contracts.confirmFunding(p.id,'client.testnet','fixture-funding-hash');
  assert.equal((await runtime.contracts.confirmFunding(p.id,'client.testnet','fixture-funding-hash')).id,c.id);
  await runtime.settle();
  assert.equal(runtime.contracts.requireContract(c.id,'client.testnet').state,'REVIEW_READY');
  assert.equal(runtime.contracts.artifacts(c.id,'client.testnet').length,2);
  assert.equal(s.db.prepare('SELECT count(*) AS n FROM inference_reservations').get().n,0);
  const settled=await runtime.contracts.confirmAcceptance(c.id,'client.testnet','fixture-settlement-hash');assert.equal(settled.state,'SETTLED');
  await runtime.contracts.confirmAcceptance(c.id,'client.testnet','fixture-settlement-hash');
  const rows=s.db.prepare('SELECT * FROM ledger_transfers ORDER BY rowid').all();assert.equal(rows.length,2);assert.equal(rows[0].amount,p.price);assert.equal(rows[1].amount,p.price);assert.equal(rows[0].credit,rows[1].debit);
  assert.throws(()=>runtime.contracts.artifacts(c.id,'other.testnet'),/not found/);
 }finally{await runtime.close();s.close();}
});
