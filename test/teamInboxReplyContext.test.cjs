const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf8')
const inbox = source.slice(source.indexOf('function TeamInbox'), source.indexOf('// ── AUTOMATIONS'))

test('Inbox renders a compact resolved quote and allows staff to start or cancel a reply', () => {
  assert.match(inbox, /message\.reply_to\?<QuotedMessage message=\{message\.reply_to\}/)
  assert.match(inbox, /setReplyTarget\(message\)/)
  assert.match(inbox, /Cancel reply/)
  assert.match(source, /function QuotedMessage/)
  assert.match(source, /Document: \$\{media\.filename/)
  assert.match(source, /Location: \$\{media\.name/)
})

test('all staff composer send paths carry only the selected internal reply relation', () => {
  assert.match(inbox, /reply_to_message_id:replyTarget\?\.id\|\|null/)
  assert.match(inbox, /body\.append\('reply_to_message_id',replyTarget\.id\)/)
  assert.match(inbox, /reply_to_message_id:replyTarget\?\.id\|\|null/)
  assert.doesNotMatch(inbox, /meta_message_id/)
})
