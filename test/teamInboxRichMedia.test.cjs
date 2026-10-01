const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf8')
const inbox = source.slice(source.indexOf('function TeamInbox'), source.indexOf('// ── AUTOMATIONS'))

test('Team Inbox renders inbound and outbound structured media without exposing Meta IDs', () => {
  assert.match(inbox, /const media=message\.inbound_media\|\|message\.outbound_media/)
  assert.match(inbox, /<InboxMedia conversationId=\{active\.id\} messageId=\{message\.id\} media=\{media\}/)
  assert.match(source, /media\.type==='document'/)
  assert.match(source, /media\.type==='location'/)
  assert.doesNotMatch(inbox, /media_id/)
})

test('composer uses authenticated, conversation-bound endpoints and disables duplicate sends', () => {
  assert.match(inbox, /conversations\/\$\{selectedId\}\/media/)
  assert.match(inbox, /conversations\/\$\{selectedId\}\/location/)
  assert.match(inbox, /actionLock\.current\|\|!canReply\|\|!attachment\?\.file/)
  assert.match(inbox, /actionLock\.current\|\|!canReply\|\|!locationDraft/)
  assert.match(inbox, /Attach image or document/)
  assert.match(inbox, /Send location/)
})

test('attachments use blob-only proxy access and locations use a customer-controlled map link', () => {
  assert.match(source, /messages\/\$\{messageId\}\/media/)
  assert.match(source, /URL\.createObjectURL\(blob\)/)
  assert.match(source, /URL\.revokeObjectURL\(url\)/)
  assert.match(source, /google\.com\/maps\?q=/)
})
