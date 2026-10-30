import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

test('Help & Guides explains all, group, and individual broadcast audiences safely', () => {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const source = fs.readFileSync(path.join(here, '../src/lib/helpGuides.js'), 'utf8')
  assert.match(source, /id:'broadcast-audiences'/)
  assert.match(source, /All contacts/)
  assert.match(source, /Contact Groups/)
  assert.match(source, /Individual contacts/)
  assert.match(source, /removes duplicate contacts/)
  assert.match(source, /Marketing opt-outs/)
  assert.match(source, /message allowance/)
})
