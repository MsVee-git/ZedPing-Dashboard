import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = fs.readFileSync(path.join(here, '..', 'src', 'ZoeAI.tsx'), 'utf8')

test('Zoe lifecycle UI keeps members read-only and labels every deployment state', () => {
  assert.match(source, /\["owner", "admin"\]\.includes/)
  assert.match(source, /Draft — not active on WhatsApp\./)
  assert.match(source, /Testing on WhatsApp — Approved test contacts only/)
  assert.match(source, /Live on WhatsApp — Responding to eligible customers/)
  assert.match(source, /Paused — not responding to WhatsApp\./)
})

test('Go Live is reviewed before its mutation and test-mode return remains explicit', () => {
  assert.match(source, /async function reviewActivation\(\)/)
  assert.match(source, /setActivationReview\(result\)/)
  assert.match(source, /onClick=\{selected\?\.lifecycle_status === "active" \? goLive : activate\}/)
  assert.match(source, /onClick=\{returnToTest\}/)
  assert.match(source, /to Test Mode\? Only approved test contacts will receive responses\./)
  assert.match(source, /Go Live with \$\{activationReview\.assistant_name\}\?/) 
})

test('Pause and Resume use explicit confirmation that preserves the current deployment mode', () => {
  assert.match(source, /Resume Live Mode\? This agent may respond to eligible customers\./)
  assert.match(source, /Resume Test Mode\? Only approved test contacts can receive responses\./)
  assert.match(source, /\/ai-agents\/"\+selected\.id\+"\/resume/)
  assert.match(source, /\/ai-agents\/"\+selected\.id\+"\/pause/)
})

test('Test-contact management is available only to managers and is not removed by lifecycle controls', () => {
  assert.match(source, /canManage && <>\s*<label className="label"[^>]*>Approved test contacts<\/label>/)
  assert.match(source, /\/test-contacts/)
  assert.match(source, /selected\.lifecycle_status!=="active"/)
})
