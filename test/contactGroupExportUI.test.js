import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import {prepareContactGroupExport} from '../src/lib/contactGroupExport.js';
const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const source=app.slice(app.indexOf('function Contacts('),app.indexOf('// ── MESSAGE LOG'))+'\nexports.Contacts=Contacts;';
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function nodes(tree){if(!tree||typeof tree!=='object')return [];return [tree,...React.Children.toArray(tree.props?.children).flatMap(nodes),...nodes(tree.props?.action)];}
async function harness(request,role='owner'){
 const states=[],refs=[],effects=[];let cursor=0,rc=0;const files=[],calls=[];
 const useState=initial=>{const i=cursor++;if(!(i in states))states[i]=initial;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v]};
 const context={exports:{},require:()=>jsxRuntime,useState,useRef:initial=>{const i=rc++;return refs[i]||(refs[i]={current:initial})},useEffect:fn=>effects.push(fn),useQueryState:(key,value)=>useState(value),useAPI:()=>({data:[],loading:false,refetch(){}}),API:'https://fixture.invalid',apiFetch:async url=>{calls.push(url);return{json:async()=>request(url)}},prepareContactGroupExport,downloadContactGroupExport:file=>files.push(file),setTimeout(){},PageHead:()=>null,ContactsImport:()=>null,Empty:()=>null,Loader:()=>null,Ic:()=>null,window:{addEventListener(){},removeEventListener(){}}};
 vm.runInNewContext(compiled,context);
 const props={customer:{id:'workspace-a',role},initialTab:'groups'};
 function render(){cursor=rc=0;return context.exports.Contacts(props)}
 const button=text=>nodes(render()).find(n=>n.type==='button'&&n.props.children===text);
 render();const initial=effects.splice(0);for(const fn of initial)fn();await new Promise(r=>setImmediate(r));
 return{render,button,files,calls,props};
}
const group={id:'g',name:'Ford enquiries',member_count:2};
const response=url=>url.endsWith('/members')?{group,members:[{contact:{name:'First',phone_number:'+260970000001'}},{contact:{name:'Last',phone_number:'+260970000002'}}]}:[group];
test('Export on the real segment card opens format choices and fetches all segment contacts',async()=>{
 const h=await harness(response);h.button('Export').props.onClick();
 await h.button('Download CSV').props.onClick();
 assert.equal(h.files.length,1);assert.equal(h.files[0].count,2);assert.ok(h.files[0].content.includes('Last'));
 assert.equal(h.calls.at(-1),'https://fixture.invalid/contact-groups/g/members');
});
test('read-capable members can export TXT; rejected requests show an error without downloading',async()=>{
 const h=await harness(response,'member');h.button('Export').props.onClick();await h.button('Phone numbers (.txt)').props.onClick();assert.equal(h.files[0].content,'+260970000001\r\n+260970000002\r\n');
 const failed=await harness(url=>{if(url.endsWith('/members'))throw new Error('Workspace denied');return[group]});failed.button('Export').props.onClick();await failed.button('Download CSV').props.onClick();assert.equal(failed.files.length,0);assert.ok(nodes(failed.render()).some(n=>n.props?.children==='Workspace denied'));
});
test('workspace changes during export discard the previous workspace download',async()=>{
 let finish;
 const h=await harness(url=>url.endsWith('/members')?new Promise(r=>finish=r):[group]);h.button('Export').props.onClick();const pending=h.button('Download CSV').props.onClick();await new Promise(r=>setImmediate(r));h.props.customer={id:'workspace-b',role:'owner'};h.render();finish(response('/members'));await pending;assert.equal(h.files.length,0);
});
