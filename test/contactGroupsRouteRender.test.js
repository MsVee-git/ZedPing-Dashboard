import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = fs.readFileSync(path.join(here, '..', 'src', 'App.tsx'), 'utf8')

test('Contact Groups route has a page entry and opens the Groups view', () => {
  assert.match(source, /contactGroups:\s*\{\s*title:\s*"Contact Groups",\s*comp:\s*<Contacts customer=\{customer\} initialTab="groups" routeGroupId=/)
  assert.match(source, /function Contacts\(\{ customer, initialTab = "contacts", routeGroupId = null, onRouteOpen, onRouteUnavailable \}\)/)
  assert.match(source, /openGroup\(group, false\)/)
  assert.match(source, /Back to Contact Groups/)
})
