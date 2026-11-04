import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('a disconnected historical number is not probed or presented as an active connection', () => {
  const source = fs.readFileSync(new URL('../src/WhatsAppConnection.tsx', import.meta.url), 'utf8')
  assert.match(source, /whatsapp_connection\?\.status === "disconnected" \? null/)
  assert.match(source, /row\?\.id && row\.status==='provisioning'/)
  assert.match(source, /latest\?\.whatsapp_connection\?\.status === "disconnected"/)
  assert.match(source, /setPhase\("idle"\)/)
})
