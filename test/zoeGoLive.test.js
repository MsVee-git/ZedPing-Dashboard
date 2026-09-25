import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const source = fs.readFileSync(new URL('../src/ZoeAI.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText
const agent = { id: 'autoguard', name: 'Autoguard Assistant', lifecycle_status: 'active', deployment_mode: 'test', configuration_version: 11, knowledge: [] }
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)]
}
function app(role = 'owner', post = async () => ({ ok: true, json: async () => ({ agent: { ...agent, deployment_mode: 'live' }, status: 'live' }) })) {
  const states = [[], [], [], [], null, '', '', [], null, '', null, [], false, '', structuredClone(agent), '']
  const ref = { current: false }, calls = []
  let cursor = 0
  const hooks = { ...React, useEffect() {}, useRef: () => ref, useState(initial) { const i = cursor++; if (states[i] === undefined) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] } }
  const context = { exports: {}, React, require: () => hooks }
  vm.runInNewContext(compiled, context)
  const render = () => { cursor = 0; return context.exports.ZoeAI({ customer: { id: 'workspace', role }, apiFetch: async (url, init) => {
    calls.push({ url, init })
    if (init?.method === 'POST') return post(url, init)
    if (url.endsWith('/readiness')) throw new Error('Only draft or paused AI Agents can be activated')
    return { ok: true, json: async () => ({ agents: [{ ...agent, deployment_mode: 'live' }], test_contacts: [] }) }
  } }) }
  const buttons = () => nodes(render()).filter(n => n.type === 'button')
  const button = label => buttons().find(n => n.props.children === label)
  const confirm = () => nodes(render()).find(n => n.props?.role === 'dialog')
  return { calls, states, render, button, confirm, html: () => renderToStaticMarkup(render()) }
}
test('active Test Mode renders Go Live and opens review without draft readiness', async () => {
  const ui = app()
  assert.match(ui.html(), /Test Mode — responding only/)
  await ui.button('Go Live').props.onClick()
  assert.ok(ui.confirm())
  assert.equal(ui.calls.length, 0)
})
for (const role of ['owner', 'admin']) test(`${role} confirms one POST, no draft payload, then refreshes to Live`, async () => {
  const ui = app(role)
  await ui.button('Go Live').props.onClick()
  const confirm = nodes(ui.confirm()).find(n => n.type === 'button' && n.props.children === 'Go Live')
  await confirm.props.onClick()
  const posts = ui.calls.filter(c => c.init?.method === 'POST')
  assert.equal(posts.length, 1)
  assert.equal(posts[0].url, '/ai-agents/autoguard/go-live')
  assert.equal(posts[0].init.body, undefined)
  assert.ok(ui.calls.some(c => c.url === '/ai-agents'))
  assert.match(ui.html(), /Live — responding to eligible WhatsApp customers/)
  assert.doesNotMatch(ui.html(), /Test Mode — responding only/)
  assert.equal(ui.states[14].configuration_version, 11)
  assert.equal(ui.calls.some(c => /\/(activate|draft|readiness)$/.test(c.url)), false)
})
test('synchronous repeated clicks cannot double-submit and pending controls are disabled', async () => {
  let resolve
  const ui = app('owner', () => new Promise(r => { resolve = r }))
  await ui.button('Go Live').props.onClick()
  const handler = nodes(ui.confirm()).find(n => n.type === 'button' && n.props.children === 'Go Live').props.onClick
  const first = handler(), second = handler()
  assert.equal(ui.calls.filter(c => c.init?.method === 'POST').length, 1)
  assert.equal(ui.button('Saving…').props.disabled, true)
  resolve({ ok: true, json: async () => ({ agent: { ...agent, deployment_mode: 'live' } }) })
  await Promise.all([first, second])
})
test('backend error is visible inside the confirmation and Test Mode is retained', async () => {
  const ui = app('owner', async () => { throw new Error('The activated AI configuration is unavailable') })
  await ui.button('Go Live').props.onClick()
  await nodes(ui.confirm()).find(n => n.type === 'button' && n.props.children === 'Go Live').props.onClick()
  const alert = nodes(ui.confirm()).find(n => n.props?.role === 'alert')
  assert.equal(alert.props.children, 'The activated AI configuration is unavailable')
  assert.equal(ui.states[14].deployment_mode, 'test')
  assert.equal(ui.button('Go Live').props.disabled, false)
})
test('unexpected errors never expose internal details', async () => {
  const ui = app('owner', async () => { throw new Error('secret-token internal stack trace') })
  await ui.button('Go Live').props.onClick()
  await nodes(ui.confirm()).find(n => n.type === 'button' && n.props.children === 'Go Live').props.onClick()
  assert.match(ui.html(), /role="alert"/)
  assert.doesNotMatch(ui.html(), /secret-token|stack trace/)
})
test('member cannot render or submit Go Live even with an existing confirmation', async () => {
  const ui = app('member')
  assert.equal(ui.button('Go Live'), undefined)
  ui.states[10] = { assistant_name: agent.name }
  await nodes(ui.confirm()).find(n => n.type === 'button' && n.props.children === 'Go Live').props.onClick()
  assert.equal(ui.calls.length, 0)
})
test('invalid success payload cannot falsely show Live', async () => {
  const ui = app('owner', async () => ({ ok: true, json: async () => ({ agent }) }))
  await ui.button('Go Live').props.onClick()
  await nodes(ui.confirm()).find(n => n.type === 'button' && n.props.children === 'Go Live').props.onClick()
  assert.match(ui.html(), /Unable to confirm Live status/)
  assert.equal(ui.states[14].deployment_mode, 'test')
})
