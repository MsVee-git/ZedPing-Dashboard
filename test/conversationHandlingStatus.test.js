import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
const require = createRequire(import.meta.url)
function load(file) {
  const source = fs.readFileSync(new URL('../src/' + file, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText
  const context = { exports: {}, require }
  vm.runInNewContext(code, context)
  return context.exports
}
const { ConversationHandlingStatus } = load('ConversationHandlingStatus.tsx')
const { MarketingOptOutBadge } = load('MarketingConsent.tsx')
const render = conversation => renderToStaticMarkup(React.createElement(ConversationHandlingStatus, { conversation }))
for (const [mode, label, color] of [['automation', 'ZOE IS HANDLING THIS CHAT', 'green'], ['needs_attention', 'NEEDS ATTENTION', 'gold'], ['human', 'TEAM MEMBER HANDLING', 'blue']]) {
  test(`${mode} renders readable ${label} with its existing badge color`, () => {
    assert.equal(render({ status: 'open', control_mode: mode }), `<span class="badge badge-${color}">${label}</span>`)
  })
}
test('refreshed handoff and takeover states update the visible label', () => {
  const conversation = { status: 'open', control_mode: 'automation' }
  assert.match(render(conversation), /ZOE IS HANDLING/)
  Object.assign(conversation, { status: 'needs_attention', control_mode: 'needs_attention' })
  assert.match(render(conversation), /NEEDS ATTENTION/)
  Object.assign(conversation, { status: 'open', control_mode: 'human', assigned_user_id: 'staff' })
  assert.match(render(conversation), /TEAM MEMBER HANDLING/)
})
test('Resolve never implies Zoe has resumed before authoritative next-inbound state', () => {
  for (const control_mode of ['human', 'automation', 'needs_attention']) assert.equal(render({ status: 'resolved', control_mode }), '<span class="badge badge-cream">Resolved</span>')
})
test('attention status remains clear regardless of assignee and unknown states do not claim Zoe', () => {
  assert.match(render({ status: 'needs_attention', control_mode: 'automation', assigned_user_id: 'staff' }), /NEEDS ATTENTION/)
  assert.match(render({ status: 'open' }), /Status unavailable/)
})
test('marketing opt-out and Zoe handling remain independent visible badges', () => {
  const conversation = { status: 'open', control_mode: 'automation', contacts: { marketing_opted_out: true } }
  const before = structuredClone(conversation)
  const html = renderToStaticMarkup(React.createElement('div', {}, React.createElement(ConversationHandlingStatus, { conversation }), React.createElement(MarketingOptOutBadge, { contact: conversation.contacts })))
  assert.match(html, /ZOE IS HANDLING THIS CHAT/)
  assert.match(html, /MARKETING OPTED OUT/)
  assert.deepEqual(conversation, before)
})
test('list, header and details share rendering while existing Inbox action endpoints and reply guards remain', () => {
  const source = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  const inbox = source.slice(source.indexOf('function TeamInbox'), source.indexOf('// ── AUTOMATIONS'))
  assert.equal((inbox.match(/<ConversationHandlingStatus conversation=/g) || []).length, 3)
  assert.equal((inbox.match(/<MarketingOptOutBadge contact=/g) || []).length, 3)
  for (const action of ['handoff', 'take', 'resolve', 'reopen']) assert.ok(inbox.includes(`runAction("/${action}"`))
  assert.match(inbox, /disabled=\{!isHuman \|\| replying\}/)
  assert.doesNotMatch(inbox, /Automation active|labelFor\(/)
})
