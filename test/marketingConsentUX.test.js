import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const require = createRequire(import.meta.url)
function component(file) {
  const source = fs.readFileSync(new URL('../src/' + file, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } })
  const context = { exports: {}, require, AbortController }
  vm.runInNewContext(outputText, context)
  return context.exports
}
const { MarketingOptOutBadge, BroadcastReviewSummary } = component('MarketingConsent.tsx')
const { BroadcastHistoryFacts, BroadcastDetails } = component('BroadcastDetails.tsx')
const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props))

test('marketing badge is exceptional, independent of automation state, and absent for ordinary contacts', () => {
  const markup = renderToStaticMarkup(React.createElement('div', {}, 'Automation active', React.createElement(MarketingOptOutBadge, { contact: { marketing_opted_out: true } })))
  assert.match(markup, /Automation active/)
  assert.match(markup, /MARKETING OPTED OUT/)
  assert.match(markup, /Service conversations remain available/)
  for (const contact of [undefined, null, {}, { marketing_opted_out: false }]) assert.equal(render(MarketingOptOutBadge, { contact }), '')
  const inbox = app.slice(app.indexOf('function TeamInbox'), app.indexOf('// ── AUTOMATIONS'))
  assert.match(inbox, /<MarketingOptOutBadge contact=\{conversation.contacts\}/)
  assert.match(inbox, /CONVERSATION DETAILS[\s\S]*<MarketingOptOutBadge contact=\{active.contacts\}/)
  assert.match(inbox, /return "Automation active"/)
})

test('Review displays server-provided 5/4/1/0 and identifies the excluded contact', () => {
  const markup = render(BroadcastReviewSummary, { review: { audience: { name: 'Test Batch' }, total_selected: 5, eligible_recipients: 4, opted_out_recipients: 1, skipped_recipients: 0, suppressed: [{ id: 'out', name: 'Opted-out customer', phone_number: '+260971000004' }] } })
  for (const [label, value] of [['Selected contacts', 5], ['Eligible recipients', 4], ['Marketing opted out', 1], ['Invalid/unavailable', 0]]) {
    assert.match(markup, new RegExp(label + '</dt><dd[^>]*>' + value + '</dd>'))
  }
  assert.match(markup, /View excluded contacts \(1\)/)
  assert.match(markup, /Opted-out customer/)
  assert.match(markup, /will not receive this broadcast/)
  assert.match(markup, /checked again when you send/)
})

test('processed history renders stored counts and zero failures without inventing consent or delivery', () => {
  const activity = { id: 'past', broadcast_name: 'lead_followup', message: '[Template] lead_followup (en_US)', status: 'completed', recorded_recipients: 5, sent_count: 5, failed_count: 0, created_at: '2026-09-25 11:06:36.235774' }
  const markup = render(BroadcastHistoryFacts, { activity })
  assert.match(markup, /Processed/)
  assert.match(markup, /Recorded recipients<\/dt><dd[^>]*>5/)
  assert.match(markup, /Failed<\/dt><dd[^>]*>0/)
  assert.match(markup, /Marketing opted out at send time<\/dt><dd[^>]*>Not recorded/)
  assert.match(markup, /does not confirm delivery/)
  assert.equal(render(BroadcastHistoryFacts, { activity, contacts: [{ marketing_opted_out: true }] }), markup)
  assert.match(render(BroadcastHistoryFacts, { activity: { id: 'missing' } }), /Recorded recipients<\/dt><dd[^>]*>Not recorded/)
})

test('processed rows open contained details with workspace-bound fetching and stale-request protection', () => {
  const section = app.slice(app.indexOf('function Broadcasts()'), app.indexOf('// ── CONTACTS'))
  assert.match(section, /onClick=\{\(\) => setActivityId\(broadcast.id\)\}/)
  assert.match(section, /<BroadcastDetails id=\{activityId\} apiBase=\{API\} apiFetch=\{apiFetch\}/)
  assert.doesNotMatch(section, /modal-bg/)
  assert.match(app, /key=\{customer\?\.id\}/)
  const detail = fs.readFileSync(new URL('../src/BroadcastDetails.tsx', import.meta.url), 'utf8')
  assert.match(detail, /apiFetch\(`\$\{apiBase\}\/broadcasts\/scheduled\//)
  assert.match(detail, /controller.abort\(\)/)
  assert.match(detail, /result\?\.id === id/)
  const markup = render(BroadcastDetails, { id: 'past', apiBase: 'https://example.invalid', apiFetch() { throw new Error('render must not fetch') }, onClose() {} })
  assert.match(markup, /Loading broadcast details/)
  assert.match(markup, /aria-labelledby="broadcast-details-title"/)
})
