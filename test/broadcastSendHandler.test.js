import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the real handler and its component-local lock declaration. No server
// or messaging provider is contacted by this harness.
const source=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('App.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const component=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='Broadcasts');
function declaration(name){
  return component.body.statements.find(node=>ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>d.name.getText(ast)===name));
}
function harness(apiFetch){
  const events=[];
  const context={useRef:value=>({current:value}),selectedTemplate:{header_media_type:'text'},broadcastHeaderFile:null,
    numberId:'number',groupId:'group',templateId:'template',mappings:{},draftKey:'workspace-user',
    FormData:class {append(){}},apiFetch,API:'https://example.invalid',
    setSendResult:value=>events.push(['completed',value]),setSending:value=>events.push(['sending',value]),setNotice:value=>events.push(['notice',value]),
    setReview(){},setTemplateId(){},setMappings(){},setBroadcastHeaderFile(){},setNumberId(){},setGroupId(){},writeDraft(){},
    refetchHistory:()=>events.push(['refresh']),onRouteOpen:id=>events.push(['route',id])};
  const lock=declaration('sendInFlight');
  const code=(lock?lock.getText(ast):'')+'\n'+declaration('send').getText(ast)+'\nglobalThis.sendHandler=send;';
  vm.runInNewContext(code,context);
  return {send:context.sendHandler,events};
}
test('Send click reaches submission and opens the resulting activity',async()=>{
  let calls=0;
  const h=harness(async(url,options)=>{calls++;assert.equal(url,'https://example.invalid/broadcasts/send-template');assert.equal(options.method,'POST');return {json:async()=>({activity_id:'activity',accepted:2,failed:0})};});
  await h.send();
  assert.equal(calls,1);
  assert.ok(h.events.some(e=>e[0]==='completed'&&e[1]?.accepted===2));
  assert.ok(h.events.some(e=>e[0]==='route'&&e[1]==='activity'));
  assert.deepEqual(h.events.at(-1),['sending',false]);
});
test('double clicking while a submission is pending makes one request',async()=>{
  let calls=0,finish;
  const h=harness(()=>{calls++;return new Promise(resolve=>{finish=()=>resolve({json:async()=>({activity_id:'activity',accepted:1,failed:0})});});});
  const first=h.send();await h.send();assert.equal(calls,1);
  finish();await first;
});
test('a failed submission releases the guard and allows a deliberate retry',async()=>{
  let calls=0;
  const h=harness(async()=>{calls++;if(calls===1)throw new Error('Network unavailable');return {json:async()=>({activity_id:'retry',accepted:1,failed:0})};});
  await h.send();assert.ok(h.events.some(e=>e[0]==='notice'&&e[1]?.ok===false));
  await h.send();assert.equal(calls,2);assert.ok(h.events.some(e=>e[0]==='route'&&e[1]==='retry'));
});
