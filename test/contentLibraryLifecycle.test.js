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

test('confirmation action sends one authenticated delete path and keeps a blocked item visible with its safe reason', () => {
  assert.match(source, /if \(!deleteTarget \|\| deletingContent\) return/)
  assert.match(source, /apiFetch\(`\$\{API\}\/content\/\$\{deleteTarget\.id\}`, \{method:"DELETE"\}\)/)
  assert.match(source, /setDeletingContent\(true\)/)
  assert.match(source, /setDeleteError\(message\); setActionError\(message\)/)
  assert.match(source, /role="alert"/)
  assert.match(source, /disabled=\{deletingContent\}/)
  assert.match(source, /Deleting…/)
  assert.match(source, /await load\(\)/)
})

test('Text Content Library editing uses debounced, visibility-flushed autosave without stale-response overwrite', () => {
  assert.match(source, /editAutosaveTimerRef/)
  assert.match(source, /window\.setTimeout\(\(\) => \{ void persistExistingText\(snapshot, revision\); \}, 1000\)/)
  assert.match(source, /document\.addEventListener\("visibilitychange"/)
  assert.match(source, /if \(revision === editRevisionRef\.current\) setEditForm/)
  assert.match(source, /editInFlightRef\.current/)
  assert.match(source, /Couldn't save — Retry/)
  assert.match(source, /Saving…/)
  assert.match(source, /Saved/)
  assert.match(source, /contentAutosaveFlushRef\.current\(\)/)
})

test('new Text creation establishes one server record before later autosaves patch the same item', () => {
  assert.match(source, /const \[creatingTextDraft, setCreatingTextDraft\] = useState\(null\)/)
  assert.match(source, /if \(creatingTextDraft\) \{[\s\S]*method: "PATCH"/)
  assert.match(source, /body\.set\("content_type", "TEXT"\)/)
  assert.match(source, /newTextDirty/)
  assert.match(source, /newTextInFlightRef\.current/)
  assert.match(source, /if \(!creating \|\| type !== "TEXT" \|\| !newTextDirty/)
})

test('Image rows load and render state-aware Zoe knowledge actions', () => {
  assert.match(source, /if \(selected\?\.content_type === "IMAGE"\) void loadImageKnowledge\(selected\)/)
  for (const label of ['Extract knowledge for Zoe', 'Extracting…', 'Review Zoe knowledge', 'View Zoe knowledge', 'Extract again', 'Retry extraction']) {
    assert.ok(source.includes(label), `expected ${label}`)
  }
})
