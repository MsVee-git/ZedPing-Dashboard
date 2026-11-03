import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

test('Help & Guides explains the released all-contact and group broadcast audiences safely', () => {
  const here = path.dirname(fileURLToPath(import.meta.url))
  const source = fs.readFileSync(path.join(here, '../src/lib/helpGuides.js'), 'utf8')
  assert.match(source, /id:'broadcast-audiences'/)
  assert.match(source, /All contacts/)
  assert.match(source, /Contact Group/)
  assert.match(source, /All contacts or Contact Group/)
  assert.doesNotMatch(source, /one or more Contact Groups, or selected individual contacts/)
  assert.match(source, /removes duplicate contacts/)
  assert.match(source, /Marketing opt-outs/)
  assert.match(source, /message allowance/)
})
