import assert from 'node:assert/strict';
import {createProfessionalApplication} from '../apps/api/professional-server.mjs';
import {openAgentStore} from '../packages/agent-runtime/store.mjs';
const store=openAgentStore({path:process.env.ECONIA_2_DATABASE_PATH||'.data/container-professional-smoke.sqlite'});
const app=await createProfessionalApplication({store,inference:{ready:false}});
try{
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 assert.equal((await fetch(base+'/api/health')).status,200);
 const config=await(await fetch(base+'/api/config')).json();assert.deepEqual(config,{mode:'professional',network:'testnet'});
 const world=await(await fetch(base+'/api/society/world')).json();assert.equal(world.agents.length,24);assert.equal(world.settlementReady,false);
 assert.equal((await fetch(base+'/api/society/conversations')).status,401);
 assert.equal((await fetch(base+'/')).status,200);
 console.log('Professional container smoke check passed: testnet-only configuration, durable database, public city, protected conversations and no unconfigured payments.');
}finally{await app.close();store.close();}
