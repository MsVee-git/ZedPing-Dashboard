import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const result = await build({entryPoints:['src/InboxMessageBody.tsx'],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react','react/jsx-runtime']});
const context={exports:{},module:{exports:{}},require:createRequire(import.meta.url)};
vm.runInNewContext(result.outputFiles[0].text,context);
const render=message=>renderToStaticMarkup(React.createElement(context.module.exports.InboxMessageBody,{message}));
const prefix='[Earlier outbound message — background, not a quoted reply]\n';
test('only explicitly marked outbound background collapses into previous campaign',()=>{
 const html=render({direction:'outbound',message_body:prefix+'Approved campaign content'});
 assert.match(html,/<details class="inbox-campaign-context">/);
 assert.doesNotMatch(html,/<details[^>]* open/);
 assert.match(html,/Previous campaign/);assert.match(html,/not a quoted reply/);
 assert.match(html,/Approved campaign content/);assert.doesNotMatch(html,/Earlier outbound message/);
});
test('ordinary messages and inbound text remain visible and HTML escaped',()=>{
 for(const message of [{direction:'inbound',message_body:prefix+'<script>unsafe</script>'},{direction:'outbound',message_body:'Your appointment is confirmed'}]){
  const html=render(message);assert.doesNotMatch(html,/<details/);assert.doesNotMatch(html,/<script>/);
 }
});
test('empty message bodies remain safe',()=>assert.equal(render({}),'<div class="inbox-message-body"></div>'));
