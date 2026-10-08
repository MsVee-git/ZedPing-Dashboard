import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import * as helpers from '../src/lib/customAutomation.js';
const source=fs.readFileSync(new URL('../src/CustomAutomationBuilder.tsx',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function nodes(tree){if(!tree||typeof tree!=='object')return [];return [tree,...React.Children.toArray(tree.props?.children).flatMap(nodes)];}
function harness({item,canManage=true,request=async()=>({ok:true}),rules=[]}={}){
 const states=[],refs=[];let cursor=0,rc=0,saved=0;const calls=[];
 const hooks={useEffect(){},useState(initial){const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return [states[i],v=>{states[i]=typeof v==='function'?v(states[i]):v}];},useRef(initial){const i=rc++;if(!refs[i])refs[i]={current:initial};return refs[i];}};
 const context={exports:{},require:name=>name==='react'?hooks:name==='react/jsx-runtime'?jsxRuntime:helpers};
 vm.runInNewContext(compiled,context);
 const render=()=>{cursor=rc=0;return context.exports.CustomAutomationBuilder({item,rules,content:[],flows:[],canManage,request:async(path,init)=>{calls.push({path,init});return request(path,init);},onSaved:()=>saved++,onClose(){}});};
 const button=text=>nodes(render()).find(n=>n.type==='button'&&n.props.children===text);
 const input=(id,value)=>nodes(render()).find(n=>n.props.id===id).props.onChange({target:{value}});
 return {render,button,input,calls,saved:()=>saved,html:()=>renderToStaticMarkup(render())};
}
test('owner can create a rule, preview without network and save once despite duplicate clicks',async()=>{
 let finish;const h=harness({request:()=>new Promise(resolve=>finish=resolve)});
 h.input('custom-phrases','PRICE');h.input('custom-response','Please ask our team.');h.input('custom-sample','price');
 h.button('Test phrase').props.onClick();assert.equal(h.calls.length,0);assert.match(h.html(),/Phrase matches/);
 const save=h.button('Save and activate').props.onClick;const a=save(),b=save();assert.equal(h.calls.length,1);
 finish({ok:true});await Promise.all([a,b]);assert.equal(h.saved(),1);
 const payload=JSON.parse(h.calls[0].init.body);assert.equal(payload.library_template_id,undefined);assert.equal(h.calls[0].path,'/automations');
});
test('server rejection retains the draft and shows the error',async()=>{
 const h=harness({request:async()=>({ok:false,json:async()=>({error:'Workspace denied'})})});
 h.input('custom-phrases','PRICE');h.input('custom-response','Ask us.');h.button('Review automation').props.onClick();await h.button('Save and activate').props.onClick();
 assert.equal(h.saved(),0);assert.match(h.html(),/Workspace denied/);assert.match(h.html(),/Ask us/);
});
test('editing a paused custom rule PATCHes without changing active state',async()=>{
 const h=harness({item:{id:'rule-1',is_active:false,trigger_value:'PRICE',message_template:'Ask us.',action_config:{kind:'send_text'}}});
 h.button('Review automation').props.onClick();await h.button('Save changes').props.onClick();
 assert.equal(h.calls[0].path,'/automations/rule-1');assert.equal(h.calls[0].init.method,'PATCH');assert.equal('is_active' in JSON.parse(h.calls[0].init.body),false);
});
test('ordinary members cannot access the custom builder',()=>{const h=harness({canManage:false});assert.equal(h.render(),null);assert.equal(h.calls.length,0);});
test('editing form after review requires another review',()=>{
 const h=harness();h.input('custom-phrases','PRICE');h.input('custom-response','Ask us.');h.button('Review automation').props.onClick();h.input('custom-response','Updated.');assert.equal(h.button('Save and activate').props.disabled,true);
});
