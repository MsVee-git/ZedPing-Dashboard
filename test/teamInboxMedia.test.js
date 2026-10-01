import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
const inbox = source.slice(source.indexOf('function TeamInbox'), source.indexOf('// ── AUTOMATIONS'))

test('Team Inbox renders inbound image media through the authenticated message proxy', () => {
  assert.match(inbox, /message\.inbound_media\?\.type==='image'/)
  assert.match(inbox, /<InboundImage conversationId=\{active\.id\} messageId=\{message\.id\} apiFetch=\{apiFetch\}\/>/)
  assert.match(source, /\/conversations\/\$\{conversationId\}\/messages\/\$\{messageId\}\/media/)
  assert.match(source, /alt="Incoming WhatsApp image"/)
  assert.doesNotMatch(source, /message\.inbound_media\.media_id/)
})

test('Team Inbox preserves captions and presents a safe unavailable state', () => {
  assert.match(inbox, /message\.message_body\?<div/)
  assert.match(source, /Loading image…/)
  assert.match(source, /Image unavailable/)
  assert.doesNotMatch(inbox, /message\.message_body\|\|'Unsupported message type'/)
})
