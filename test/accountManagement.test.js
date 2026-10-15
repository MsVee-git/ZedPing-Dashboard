import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createAccountService, validateDisplayName, validatePassword } from '../src/lib/accountManagement.js';

function harness() {
 const calls = []; let current = {id:'u1',email:'owner@example.com',user_metadata:{business_name:'Keep me'}};
 const auth = {
  getUser: async () => ({data:{user:current},error:null}),
  updateUser: async (...args) => {calls.push(['update',...args]);return {data:{user:{...current,...args[0]}},error:null};},
  reauthenticate: async () => {calls.push(['reauthenticate']);return {error:null};},
  signOut: async options => {calls.push(['signout',options]);return {error:null};}
 };
 let verificationError = null;
 const verifyPassword = async (...args) => {calls.push(['verify',...args]);if(verificationError)throw verificationError;};
 return {calls,auth,setUser:u=>current=u,failVerification:()=>verificationError=new Error('Incorrect password'),service:createAccountService({auth,verifyPassword,userId:'u1'})};
}
test('display name validation rejects empty, control and oversized names', () => {
 for(const name of ['', ' ', 'x'.repeat(101), 'x\n']) assert.throws(()=>validateDisplayName(name==='x\n'?'a\nb':name));
 assert.equal(validateDisplayName(' Vee '),'Vee');
});
test('saving personal name sends only a name metadata patch', async () => {
 const h=harness();await h.service.saveName(' Vee ');
 assert.deepEqual(h.calls,[['update',{data:{name:'Vee'}}]]);
});
test('expired or substituted identity blocks mutations', async () => {
 const h=harness();h.setUser({id:'another',email:'other@example.com'});
 await assert.rejects(h.service.saveName('Vee'),/session changed/);assert.equal(h.calls.length,0);
});
test('invalid or mismatched new password never authenticates or mutates', async () => {
 const h=harness();await assert.rejects(h.service.changePassword({currentPassword:'oldpass1',password:'short',confirmation:'short'}));
 await assert.rejects(h.service.changePassword({currentPassword:'oldpass1',password:'newpass123',confirmation:'different'}));
 assert.equal(h.calls.length,0);
});
test('wrong current password prevents a sensitive update', async () => {
 const h=harness();h.failVerification();
 await assert.rejects(h.service.changePassword({currentPassword:'wrong',password:'newpass123',confirmation:'newpass123'}),/Incorrect password/);
 assert.ok(!h.calls.some(c=>c[0]==='update'));
});
test('password update preserves verification nonce and never sends the old password as metadata', async () => {
 const h=harness();await h.service.changePassword({currentPassword:'oldpass123',password:'newpass123',confirmation:'newpass123',nonce:' 123456 '});
 assert.deepEqual(h.calls,[['verify','owner@example.com','oldpass123','u1'],['update',{password:'newpass123',nonce:'123456'}]]);
});
test('identity change during verification blocks the update', async () => {
 const h=harness();const service=createAccountService({auth:h.auth,userId:'u1',verifyPassword:async()=>h.setUser({id:'u2',email:'other@example.com'})});
 await assert.rejects(service.changePassword({currentPassword:'oldpass123',password:'newpass123',confirmation:'newpass123'}),/session changed/);
 assert.equal(h.calls.length,0);
});
test('email update is verified and delegates confirmation to Auth', async () => {
 const h=harness();await h.service.changeEmail({email:' new@example.com ',currentPassword:'current',redirectTo:'https://app.zedping.app/settings/account'});
 assert.deepEqual(h.calls,[['verify','owner@example.com','current','u1'],['update',{email:'new@example.com'},{emailRedirectTo:'https://app.zedping.app/settings/account'}]]);
});
test('same or malformed email never mutates', async () => {
 const h=harness();
 for(const email of ['bad','OWNER@example.com'])await assert.rejects(h.service.changeEmail({email,currentPassword:'current'}));
 assert.equal(h.calls.length,0);
});
test('signing out other sessions uses others scope only', async () => {
 const h=harness();await h.service.signOutOthers();assert.deepEqual(h.calls,[['signout',{scope:'others'}]]);
});
test('verification code uses the signed-in Auth reauthentication endpoint', async () => {
 const h=harness();await h.service.sendVerificationCode();assert.deepEqual(h.calls,[['reauthenticate']]);
});
test('provider errors propagate instead of reporting a saved change', async () => {
 const h=harness();h.auth.updateUser=async()=>({error:new Error('Policy rejected')});
 await assert.rejects(h.service.saveName('Vee'),/Policy rejected/);
});
test('password verifier uses isolated nonpersistent Auth and revokes its temporary session', async () => {
 const source=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const start=source.indexOf('async function verifyAccountPassword(');
 const body=source.slice(start,source.indexOf('const WORKSPACE_STORAGE_KEY',start));
 const calls=[];const context={SUPABASE_URL:'https://example.com',SUPABASE_ANON:'public',createClient:(url,key,options)=>{
  calls.push(['options',options]);return {auth:{signInWithPassword:async()=>({data:{user:{id:'u1'}},error:null}),signOut:async options=>{calls.push(['signout',options]);return {error:null};}}};
 }};
 vm.createContext(context);vm.runInContext(body+';this.verify=verifyAccountPassword;',context);
 await context.verify('owner@example.com','current','u1');
 assert.equal(calls[0][1].auth.persistSession,false);assert.equal(calls[0][1].auth.autoRefreshToken,false);
 assert.equal(calls[1][1].scope,'local');
});
