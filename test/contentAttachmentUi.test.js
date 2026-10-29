import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { customAutomationPayload } from '../src/lib/customAutomation.js'

const builder = fs.readFileSync(new URL('../src/CustomAutomationBuilder.tsx', import.meta.url), 'utf8')
const zoe = fs.readFileSync(new URL('../src/ZoeAI.tsx', import.meta.url), 'utf8')
const inbox = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')

test('keyword automation preserves the selected Content Library item identifier for attachment delivery', () => {
  const payload = customAutomationPayload({ phrases:'MENU', kind:'content_library', response:'', contentId:'content-file', flowId:'', priority:100 })
  assert.equal(payload.content_library_item_id, 'content-file')
  assert.match(builder, /Choose Text, Link, Image, or PDF content/)
  assert.match(builder, /Archived files cannot be sent/)
})

test('ZedPing Ai draft configuration loads and saves explicit file selections without an Update Live call', () => {
  assert.match(zoe, /\/ai-agents\/shareable-items/)
  assert.match(zoe, /shareable_content_item_ids/)
  assert.match(zoe, /Files this agent can share/)
  assert.match(zoe, /If several files could match, the agent will ask which one they mean/)
  assert.match(zoe, /Saving changes updates the draft\. It does not change the Live agent until Update Live Agent is used\./)
})

test('Team Inbox keeps existing outgoing-media previews and delivery status rendering', () => {
  assert.match(inbox, /message\.inbound_media\|\|message\.outbound_media/)
  assert.match(inbox, /direction==='outbound'\?'Outgoing':'Incoming'/)
  assert.match(inbox, /Document unavailable/)
  assert.match(inbox, /message\.status\|\|'—'/)
})
