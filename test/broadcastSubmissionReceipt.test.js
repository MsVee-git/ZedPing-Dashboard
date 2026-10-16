import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const source=fs.readFileSync(new URL('../src/BroadcastSubmissionReceipt.tsx',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
const context={exports:{},require:createRequire(import.meta.url)};
vm.runInNewContext(code,context);
const render=result=>renderToStaticMarkup(React.createElement(context.exports.BroadcastSubmissionReceipt,{result}));
test('completed submission shows a disabled Sent button and separate delivery explanation',()=>{
  const html=render({accepted:357,failed:0});
  assert.match(html,/>Sent<\/button>/);assert.match(html,/disabled/);assert.match(html,/Delivery is tracked below/);assert.doesNotMatch(html,/Sending…/);
});
test('mixed submission does not claim the entire broadcast was sent',()=>{
  assert.match(render({accepted:8,failed:183}),/>Partially sent<\/button>/);
  assert.match(render({accepted:0,failed:357}),/>Not sent<\/button>/);
});
test('no completion receipt appears while the broadcast is still running',()=>{
  assert.equal(render(null),'');
});
