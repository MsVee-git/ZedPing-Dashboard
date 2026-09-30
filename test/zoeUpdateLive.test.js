import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const source = fs.readFileSync(new URL('../src/ZoeAI.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText
const baseAgent = { id: 'autoguard', name: 'AutoGuard Assistant', lifecycle_status: 'active', deployment_mode: 'live', configuration_version: 12, activated_configuration_version: 11, knowledge: [] }

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)]
}

function app({ role = 'owner', changes = true, post } = {}) {
  let serverAgent = { ...baseAgent, changes_not_live_yet: changes }
  const states = [[], [], [], [], null, '', '', [], null, '', null, [], false, '', structuredClone(serverAgent), '', false, '']
  const refs = [{ current: false }, { current: false }]
  const calls = []
  let cursor = 0
  let refCursor = 0
  const hooks = {
    ...React,
    useEffect() {},
    useRef() { return refs[refCursor++] },
    useState(initial) {
      const index = cursor++
      if (states[index] === undefined) states[index] = initial
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value }]
    },
  }
  const context = { exports: {}, React, require: () => hooks }
  vm.runInNewContext(compiled, context)
  const apiFetch = async (url, init) => {
    calls.push({ url, init })
    if (init?.method === 'POST') return post?.(url, init, { updateServer(agent) { serverAgent = agent } }) || { ok: true, json: async () => ({ activation: { version: 12, activated_at: '2026-09-30T09:30:00Z' } }) }
    return { ok: true, json: async () => ({ agents: [serverAgent], test_contacts: [] }) }
  }
  const render = () => {
    cursor = 0
    refCursor = 0
    return context.exports.ZoeAI({ customer: { id: 'workspace', role }, apiFetch })
  }
  const buttons = () => nodes(render()).filter(node => node.type === 'button')
  const button = label => buttons().find(node => node.props.children === label)
  const dialog = () => nodes(render()).find(node => node.props?.['aria-label'] === 'Update Live Agent')
  return { calls, states, render, button, dialog, html: () => renderToStaticMarkup(render()) }
}

test('an active agent without draft divergence does not offer Update Live', () => {
  const ui = app({ changes: false })
  assert.doesNotMatch(ui.html(), /Changes not live yet|Update Live Agent/)
  assert.equal(ui.calls.some(call => call.url.endsWith('/update-live')), false)
})

test('an active agent with divergence shows the current live version and requires confirmation', async () => {
  const ui = app()
  assert.match(ui.html(), /Changes not live yet/)
  assert.match(ui.html(), /Live version 11/)
  await ui.button('Update Live Agent').props.onClick()
  assert.ok(ui.dialog())
  assert.equal(ui.calls.some(call => call.url.endsWith('/update-live')), false)
})

test('a valid Update Live confirmation posts once, refreshes state, and clears divergence', async () => {
  const ui = app({ post: async (url, _init, server) => {
    assert.equal(url, '/ai-agents/autoguard/update-live')
    server.updateServer({ ...baseAgent, configuration_version: 12, activated_configuration_version: 12, changes_not_live_yet: false })
    return { ok: true, json: async () => ({ activation: { version: 12, activated_at: '2026-09-30T09:30:00Z' } }) }
  } })
  await ui.button('Update Live Agent').props.onClick()
  await nodes(ui.dialog()).find(node => node.type === 'button' && node.props.children === 'Update Live Agent').props.onClick()
  assert.equal(ui.calls.filter(call => call.url.endsWith('/update-live')).length, 1)
  assert.ok(ui.calls.some(call => call.url === '/ai-agents'))
  assert.match(ui.html(), /Live agent updated successfully/)
  assert.doesNotMatch(ui.html(), /Changes not live yet/)
  assert.equal(ui.states[14].activated_configuration_version, 12)
})

test('a backend activation failure remains visible and preserves the draft-divergence state', async () => {
  const ui = app({ post: async () => ({ ok: false, json: async () => ({ error: 'Only an active AI Agent can update the live version' }) }) })
  await ui.button('Update Live Agent').props.onClick()
  await nodes(ui.dialog()).find(node => node.type === 'button' && node.props.children === 'Update Live Agent').props.onClick()
  const alert = nodes(ui.dialog()).find(node => node.props?.role === 'alert')
  assert.equal(alert.props.children, 'Only an active AI Agent can update the live version')
  assert.match(ui.html(), /Changes not live yet/)
  assert.equal(ui.states[14].activated_configuration_version, 11)
})

test('an incomplete activation confirmation never reports success', async () => {
  const ui = app({ post: async () => ({ ok: true, json: async () => ({ activation: { version: 12 } }) }) })
  await ui.button('Update Live Agent').props.onClick()
  await nodes(ui.dialog()).find(node => node.type === 'button' && node.props.children === 'Update Live Agent').props.onClick()
  assert.match(ui.html(), /Unable to confirm that the live version was updated/)
  assert.match(ui.html(), /Changes not live yet/)
})

test('members cannot render or submit Update Live', async () => {
  const ui = app({ role: 'member' })
  assert.equal(ui.button('Update Live Agent'), undefined)
  ui.states[16] = true
  const confirmation = nodes(ui.dialog()).find(node => node.type === 'button' && node.props.children === 'Update Live Agent')
  await confirmation.props.onClick()
  assert.equal(ui.calls.length, 0)
})

test('synchronous duplicate confirmation clicks submit only one update', async () => {
  let resolve
  const ui = app({ post: () => new Promise(done => { resolve = done }) })
  await ui.button('Update Live Agent').props.onClick()
  const handler = nodes(ui.dialog()).find(node => node.type === 'button' && node.props.children === 'Update Live Agent').props.onClick
  const first = handler()
  const second = handler()
  assert.equal(ui.calls.filter(call => call.url.endsWith('/update-live')).length, 1)
  assert.equal(ui.button('Updating…').props.disabled, true)
  resolve({ ok: true, json: async () => ({ activation: { version: 12, activated_at: '2026-09-30T09:30:00Z' } }) })
  await Promise.all([first, second])
})
