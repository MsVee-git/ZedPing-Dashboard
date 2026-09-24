import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('./App.tsx', import.meta.url), 'utf8')

test('Broadcasts uses the server-scoped template review flow instead of browser group membership reads', () => {
  const section = source.slice(source.indexOf('function Broadcasts()'), source.indexOf('// ── CONTACTS'))
  assert.match(section, /\/broadcasts\/setup/)
  assert.match(section, /\/broadcasts\/templates\?whatsapp_number_id=/)
  assert.match(section, /\/broadcasts\/review-template/)
  assert.match(section, /\/broadcasts\/send-template/)
  assert.match(section, /Refresh templates/)
  assert.match(section, /Review before sending/)
  assert.doesNotMatch(section, /supabase\.from\("contact_group_members"/)
  assert.doesNotMatch(section, /\/broadcasts\/send["`]/)
})

test('Broadcasts does not send while reviewing and renders required variable mapping controls', () => {
  const section = source.slice(source.indexOf('function Broadcasts()'), source.indexOf('// ── CONTACTS'))
  assert.match(section, /const reviewBroadcast/)
  assert.match(section, /Template variable/)
  assert.match(section, /Resolve recipient data before sending/)
  assert.match(section, /disabled=\{sending \|\| review\.skipped_recipients > 0/)
})

