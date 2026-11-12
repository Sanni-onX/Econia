import test from 'node:test';
import assert from 'node:assert/strict';
import {Account,KeyPair,baseDecode} from 'near-api-js';
import {signMessage} from 'near-api-js/nep413';
import {createServiceAuth} from '../packages/agent-sdk/service-auth.mjs';
const key=KeyPair.fromRandom('ed25519');
const publicKey=key.getPublicKey().toString();
const id=Buffer.from(baseDecode(publicKey.slice(8))).toString('hex');
const missing=()=>Object.assign(Error('missing'),{name:'AccountDoesNotExistError',accountId:id});
async function proof(auth,accountId=id,signingKey=key){
 const c=auth.challenge(accountId);
 const signed=await signMessage({signerAccount:new Account(accountId,{},signingKey.toString()),payload:{message:c.message,recipient:c.recipient,nonce:Buffer.from(c.nonce,'base64')}});
 return {challengeId:c.id,accountId,publicKey:signingKey.getPublicKey().toString(),signature:Buffer.from(signed.signature).toString('base64')};
}
test('uncreated implicit wallet signs in with its actual NEP-413 proof without gas',async()=>{
 const auth=createServiceAuth({provider:{viewAccount:async()=>{throw missing();},viewAccessKey:async()=>{throw Error('Should not query absent key');}}});
 const p=await proof(auth);const session=await auth.login(p);
 assert.equal(auth.require('Bearer '+session.token),id);
 await assert.rejects(auth.login(p),/Expired|mismatched/);
});
test('uncreated address still rejects an invalid signature',async()=>{
 const auth=createServiceAuth({provider:{viewAccount:async()=>{throw missing();}}});
 const p=await proof(auth);p.signature=Buffer.alloc(64).toString('base64');
 await assert.rejects(auth.login(p),/Signature verification failed/);
});
test('existing implicit account requires its currently registered FullAccess key',async()=>{
 const auth=createServiceAuth({provider:{viewAccount:async()=>({}),viewAccessKey:async()=>{throw Error('Rotated key is absent');}}});
 await assert.rejects(auth.login(await proof(auth)),/Rotated key is absent/);
});
test('RPC failure cannot substitute for a nonexistent-account proof',async()=>{
 const auth=createServiceAuth({provider:{viewAccount:async()=>{throw Error('RPC unavailable');}}});
 await assert.rejects(auth.login(await proof(auth)),/RPC unavailable/);
});
test('another key cannot claim an implicit address',async()=>{
 const auth=createServiceAuth({provider:{viewAccessKey:async()=>{throw Error('Unregistered key');}}});
 await assert.rejects(auth.login(await proof(auth,id,KeyPair.fromRandom('ed25519'))),/Unregistered key/);
});
test('named accounts cannot use the implicit-address path',async()=>{
 const auth=createServiceAuth({provider:{viewAccessKey:async()=>{throw missing();}}});
 await assert.rejects(auth.login(await proof(auth,'someone.near')),/missing/);
});
test('a missing-account error for another address does not authorize sign-in',async()=>{
 const auth=createServiceAuth({provider:{viewAccount:async()=>{throw Object.assign(missing(),{accountId:'other.near'});}}});
 await assert.rejects(auth.login(await proof(auth)),/missing/);
});
