import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

test('Help & Guides includes safe Content Library attachment sharing instructions', () => {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const source = fs.readFileSync(path.join(here, '../src/lib/helpGuides.js'), 'utf8')
  assert.match(source, /id:'content-library-files'/)
  assert.match(source, /Files this agent can share/)
  assert.match(source, /Update Live Agent/)
  assert.match(source, /several similar files, it asks the customer which one they mean/)
  assert.match(source, /Archived, unsupported, changed, or unavailable files are not sent/)
})
