import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const source = fs.readFileSync(path.join(here, '..', 'src', 'ZoeAI.tsx'), 'utf8')

test('Zoe route initializes selected state before an effect reads it', () => {
  const selectedState = source.indexOf('const [selected,setSelected]=useState(null);')
  const routeEffect = source.indexOf('if (!routeAgentId || !agents.length) return;')
  assert.ok(selectedState >= 0, 'Zoe selected state must exist')
  assert.ok(routeEffect >= 0, 'Zoe deep-link effect must exist')
  assert.ok(selectedState < routeEffect, 'Zoe route effect must not read selected before its hook initializes')
})
