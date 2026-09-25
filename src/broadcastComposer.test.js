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



test('Broadcasts labels connected numbers from the canonical display phone while retaining the workspace number record as its value', () => {
  const section = source.slice(source.indexOf('function Broadcasts()'), source.indexOf('// ── CONTACTS'))
  assert.match(source, /function connectedWhatsAppNumberLabel\(number\)/)
  assert.match(section, /value=\{number\.id\}/)
  assert.match(section, /connectedWhatsAppNumberLabel\(number\)/)
  assert.doesNotMatch(section, /\{number\.display_name \|\| number\.phone_number_id\}/)
})

test('Broadcast Review separates opted-out suppression from invalid recipients and blocks an empty audience', () => {
  const section = source.slice(source.indexOf('function Broadcasts()'), source.indexOf('// ── CONTACTS'))
  assert.match(section, /<BroadcastReviewSummary review=\{review\}/)
  assert.match(section, /disabled=\{sending \|\| review\.skipped_recipients > 0 \|\| !review\.eligible_recipients\}/)
})
