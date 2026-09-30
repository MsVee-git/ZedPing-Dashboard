import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const source = fs.readFileSync(new URL('../src/ZoeAI.tsx', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return []
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)]
}

function draft() {
  return { id: 'draft-agent', template_key: 'sales_interest', assistant_name: 'Sales Assistant', communication_style: 'friendly', whatsapp_number_id: 'number-1', knowledge_item_ids: ['knowledge-1'], handoff: { person: true, unknown: true, phrases: ['complaint'] }, commercial_action: null }
}

function app({ role = 'owner', initialDraft = null, initialSelected = null } = {}) {
  const states = [[{ key: 'sales_interest', title: 'Sales' }], [], [{ id: 'knowledge-1', name: 'Products', source_type: 'text' }], [{ id: 'number-1', phone_number: '+260 771 442 247' }], initialDraft, '', '', [], null, '', null, [], false, '', initialSelected, '', false, '']
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
    }
  }
  const context = { exports: {}, React, require: () => hooks }
  vm.runInNewContext(compiled, context)
  const apiFetch = async (url, init) => {
    calls.push({ url, init })
    if (init?.method) return { ok: true, json: async () => ({ agent: { id: 'draft-agent', ...JSON.parse(init.body), lifecycle_status: 'draft', knowledge: [] } }) }
    if (url.endsWith('/library')) return { ok: true, json: async () => ({ templates: states[0] }) }
    if (url.endsWith('/knowledge-items')) return { ok: true, json: async () => ({ items: states[2] }) }
    if (url.endsWith('/numbers')) return { ok: true, json: async () => ({ numbers: states[3] }) }
    return { ok: true, json: async () => ({ agents: [] }) }
  }
  const render = () => { cursor = 0; refCursor = 0; return context.exports.ZoeAI({ customer: { id: 'workspace', role }, apiFetch }) }
  const input = label => nodes(render()).find(node => node.type === 'input' && node.props?.['aria-label'] === label)
  const button = label => nodes(render()).find(node => node.type === 'button' && node.props.children === label)
  return { states, calls, render, input, button, html: () => renderToStaticMarkup(render()) }
}

test('existing commercial configuration loads with product/service preserved and optional fields selected', () => {
  const ui = app({ initialDraft: { ...draft(), commercial_action: { type: 'quotation', qualification_fields: ['product_or_service', 'vehicle_year'], handoff_reason: 'Prepare a quotation' } } })
  assert.equal(ui.input('Handle quotation requests').props.checked, true)
  assert.equal(ui.input('Qualification field: Product / service').props.checked, true)
  assert.equal(ui.input('Qualification field: Product / service').props.disabled, true)
  assert.equal(ui.input('Qualification field: Vehicle year').props.checked, true)
  assert.equal(ui.input('Quotation handoff reason').props.value, 'Prepare a quotation')
})

test('an owner can enable quotation handling with the minimum product/service field', () => {
  const ui = app({ initialDraft: draft() })
  ui.input('Handle quotation requests').props.onChange({ target: { checked: true } })
  assert.equal(JSON.stringify(ui.states[4].commercial_action), JSON.stringify({
    type: 'quotation',
    qualification_fields: [{ key: 'product_or_service', required: true }],
    handoff_reason: 'Quotation requested'
  }))
})

test('owners can configure optional generic fields without automotive defaults', () => {
  const ui = app({ initialDraft: { ...draft(), commercial_action: { type: 'quotation', qualification_fields: ['product_or_service'] } } })
  assert.equal(ui.input('Qualification field: Vehicle make').props.checked, false)
  ui.input('Qualification field: Quantity').props.onChange()
  assert.equal(JSON.stringify(ui.states[4].commercial_action.qualification_fields.map(item => item.key)), JSON.stringify(['product_or_service', 'quantity']))
  const commercial = source.slice(source.indexOf('Commercial actions'), source.indexOf('Saving changes updates the draft'))
  assert.doesNotMatch(commercial, /AutoGuard|Ranger|Ford/i)
})

test('saving sends commercial_action with unrelated draft configuration and does not invoke Update Live', async () => {
  const ui = app({ initialDraft: { ...draft(), commercial_action: { type: 'quotation', qualification_fields: ['product_or_service'], handoff_reason: 'Quotation requested' } } })
  await ui.button('Save draft').props.onClick()
  const call = ui.calls.find(item => item.url === '/ai-agents/draft-agent/draft')
  assert.ok(call)
  const payload = JSON.parse(call.init.body)
  assert.equal(payload.commercial_action.type, 'quotation')
  assert.equal(payload.handoff.person, true)
  assert.deepEqual(payload.knowledge_item_ids, ['knowledge-1'])
  assert.equal(ui.calls.some(item => item.url.endsWith('/update-live')), false)
  assert.match(source, /Saving changes updates the draft\. It does not change the Live agent until Update Live Agent is used\./)
})

test('an active agent opens a draft editor and retains its immutable Live version until Update Live', () => {
  const active = { id: 'live-agent', name: 'Sales Assistant', lifecycle_status: 'active', deployment_mode: 'live', activated_configuration_version: 8, template_key: 'sales_interest', whatsapp_number_id: 'number-1', knowledge: [{ id: 'knowledge-1' }], configuration: { communication_style: 'friendly', handoff: { person: true, unknown: true }, commercial_action: { type: 'quotation', qualification_fields: ['product_or_service'] } } }
  const ui = app({ initialSelected: active })
  ui.button('Edit draft').props.onClick()
  assert.equal(ui.states[4].id, 'live-agent')
  assert.equal(ui.states[4].commercial_action.type, 'quotation')
  assert.equal(ui.states[14].activated_configuration_version, 8)
})

test('disabling quotation handling removes only the draft commercial action', () => {
  const ui = app({ initialDraft: { ...draft(), commercial_action: { type: 'quotation', qualification_fields: ['product_or_service'] } } })
  ui.input('Handle quotation requests').props.onChange({ target: { checked: false } })
  assert.equal(ui.states[4].commercial_action, null)
  assert.equal(ui.states[4].handoff.person, true)
})

test('members remain read-only and cannot open the draft commercial configuration', () => {
  const ui = app({ role: 'member' })
  assert.equal(ui.button('Create AI Agent'), undefined)
  assert.doesNotMatch(ui.html(), /Commercial actions/)
})

test('the existing Update Live divergence workflow remains present for saved active drafts', () => {
  assert.match(source, /changes_not_live_yet === true/)
  assert.match(source, /Update Live Agent/)
  assert.match(source, /\/ai-agents\/"\+agentId\+"\/update-live/)
})
