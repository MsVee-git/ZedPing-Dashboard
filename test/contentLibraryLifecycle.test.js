import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = fs.readFileSync(path.join(here, '..', 'src', 'App.tsx'), 'utf8')

test('Content Library uses SVG component icons for every visible content type', () => {
  assert.match(source, /const icon = \(contentType\) => \(\{ TEXT: "file", DOCUMENT: "file", IMAGE: "image", LINK: "link", WHATSAPP_TEMPLATE_REFERENCE: "template" \}/)
  assert.match(source, /<Ic n=\{icon\(item\.content_type\)\}/)
  assert.doesNotMatch(source, /TEXT:\s*"✦"|DOCUMENT:\s*"▤"|IMAGE:\s*"▧"|LINK:\s*"↗"/)
})

test('Content Library renders archive lifecycle, safe permanent-delete confirmation, and truthful storage warning', () => {
  assert.match(source, /\[\["active","Active"\],\["archived","Archived"\],\["all","All"\]\]/)
  assert.match(source, /Archive content/)
  assert.match(source, /Restore content/)
  assert.match(source, /Delete permanently/)
  assert.match(source, /Delete “\{deleteTarget\.name\}” permanently\?/) 
  assert.match(source, /storage_cleanup === "failed"/)
})

test('Image rows load and render state-aware Zoe knowledge actions', () => {
  assert.match(source, /if \(selected\?\.content_type === "IMAGE"\) void loadImageKnowledge\(selected\)/)
  for (const label of ['Extract knowledge for Zoe', 'Extracting…', 'Review Zoe knowledge', 'View Zoe knowledge', 'Extract again', 'Retry extraction']) {
    assert.ok(source.includes(label), `expected ${label}`)
  }
})
