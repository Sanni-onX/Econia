import test from 'node:test';
import assert from 'node:assert/strict';
import {openAgentStore} from '../packages/agent-runtime/store.mjs';
import {createProfessionalRuntime} from '../packages/agent-runtime/runtime.mjs';
import {createProfessionalApplication} from '../apps/api/professional-server.mjs';
test('Professional API keeps exploration public, protects conversations and refuses uncommissioned funding',async()=>{
 const store=openAgentStore({path:':memory:'});
 const runtime=createProfessionalRuntime({store,inference:{ready:true,name:'explicit-api-fixture',infer:async()=>({model:'fixture',tokens:20,value:{action:'PROPOSE',message:'I can compare your supplied supplier records.',serviceId:'procurement-plan',scope:'Compare supplied supplier records and identify unresolved delivery risks.',input:'Supplier A quotes 20 units with Monday delivery. Supplier B quotes 18 units and has no confirmed delivery date.',priceYocto:'10000000000000000000000',collaborators:[]}})}});
 const auth={require:header=>{if(!['Bearer client.testnet','Bearer stranger.testnet'].includes(header))throw Object.assign(Error('Sign in required'),{status:401});return header.slice(7);}};
 const app=await createProfessionalApplication({store,runtime,auth});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.server.address().port;
 const request=(path,body,token='client.testnet',origin)=>fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(origin?{Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{})});
 try{
  const world=await(await request('/api/society/world',null,null)).json();assert.equal(world.agents.length,24);assert.equal(world.network,'testnet');assert.equal(world.settlementReady,false);assert.ok(!JSON.stringify(world).includes('secretKey'));
  assert.equal((await request('/api/society/conversations',null,null)).status,401);
  assert.equal((await request('/api/society/conversations',{agentId:'person_199'},'client.testnet','https://untrusted.example')).status,403);
  const c=await(await request('/api/society/conversations',{agentId:'person_199'})).json();
  const result=await request('/api/society/conversations/'+c.id+'/messages',{content:'Please compare my supplied suppliers and identify the delivery risks.',requestId:'private-api-msg-001'});assert.equal(result.status,202);
  await runtime.settle();
  const own=await(await request('/api/society/conversations/'+c.id)).json();assert.equal(own.messages.length,2);assert.equal(own.proposals.length,1);
  assert.equal((await request('/api/society/conversations/'+c.id,null,'stranger.testnet')).status,404);
  const funding=await request('/api/society/proposals/'+own.proposals[0].id+'/funding',{});assert.equal(funding.status,503);assert.match((await funding.json()).error,/not commissioned/);
  const publicAfter=await(await request('/api/society/world',null,null)).json();assert.ok(publicAfter.events.length>0);assert.ok(!JSON.stringify(publicAfter).includes('Supplier A quotes'));
 }finally{await app.close();store.close();}
});
