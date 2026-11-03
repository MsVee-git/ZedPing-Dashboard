import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('campaign composer submits an explicit all-contacts audience while preserving group selection', () => {
  const source = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8')
  assert.match(source, /audienceType.*all_contacts/)
  assert.match(source, />All contacts</)
  assert.match(source, /audience_type: audienceType/)
  assert.match(source, /audienceType === "contact_group" \? \{ contact_group_id: groupId \} : \{\}/)
  assert.match(source, /if \(audienceType === "contact_group"\) form\.append\("contact_group_id", groupId\)/)
  assert.match(source, /Marketing opt-outs, duplicates and invalid recipients remain excluded/)
})
