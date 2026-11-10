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

test('the connection screen confirms disconnect before posting the selected number', () => {
  const source = fs.readFileSync(new URL('../src/WhatsAppConnection.tsx', import.meta.url), 'utf8')
  const action = source.slice(source.indexOf('const disconnect ='), source.indexOf('const retryProvisioning'))
  assert.match(source, /connection\.status === "connected" && canManage && <button[^>]+onClick=\{disconnect\}/)
  assert.match(action, /if \(!window\.confirm\([\s\S]+?\)\) return;[\s\S]+?apiFetch\(/)
  assert.match(action, /encodeURIComponent\(connection\.id\)\}\/disconnect`?, \{ method: "POST" \}/)
  assert.match(action, /whatsapp_connection: \{ \.\.\.previous\.whatsapp_connection, status: "disconnected" \}/)
})
