import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import * as status from '../src/lib/campaignStatus.js';
const require=createRequire(import.meta.url);
function compile(path,overrides={}) {
  const source=fs.readFileSync(new URL(path,import.meta.url),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React,esModuleInterop:true}}).outputText;
  const context={exports:{},require:id=>overrides[id] || require(id)};
  vm.runInNewContext(code,context);
  return context.exports;
}
const receipt=compile('../src/BroadcastSubmissionReceipt.tsx');
const {BroadcastHistoryFacts}=compile('../src/BroadcastDetails.tsx',{'./BroadcastSubmissionReceipt':receipt,'./lib/campaignStatus.js':status});
const render=activity=>renderToStaticMarkup(React.createElement(BroadcastHistoryFacts,{activity}));
test('reopened details render saved Sent confirmation and separate provider failures',()=>{
  const html=render({id:'saved',status:'completed',sent_count:395,failed_count:0,delivery:{delivered:212,read:113,failed:139,sent_pending:44,accepted_pending:0,unconfirmed:0,failure_reasons:{'Spam Rate limit hit':120}}});
  assert.match(html,/>Sent<\/button>/);
  assert.match(html,/395 accepted for sending/);
  assert.match(html,/139 messages were not delivered by WhatsApp/);
  assert.doesNotMatch(html,/Sending broadcast/);
});
test('details remain Sending until the stored campaign finishes',()=>{
  const html=render({id:'running',status:'sending',sent_count:10,failed_count:0});
  assert.match(html,/Sending broadcast/);
  assert.doesNotMatch(html,/>Sent<\/button>/);
});

test('sending details show saved progress instead of requiring the original send request',()=>{
  const html=render({id:'running',status:'sending',sent_count:20,failed_count:5,recorded_recipients:85});
  assert.match(html,/<progress[^>]*value="25"[^>]*max="85"/);
  assert.match(html,/25 of 85 recipients processed/);
  assert.doesNotMatch(html,/>Sent<\/button>/);
});
