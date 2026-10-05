import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const code=ts.transpileModule(fs.readFileSync(new URL('../src/lib/dashboardRouting.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const context={exports:{}};vm.runInNewContext(code,context);
const {parseDashboardRoute:parse,routeToPath:path}=context.exports;
test('canonical pages and resource links round-trip without losing identity',()=>{
  for(const [url,section,kind,id] of [
    ['/campaigns','broadcasts'],['/campaigns/new','broadcasts','campaign','new'],['/campaigns/c1','broadcasts','campaign','c1'],
    ['/contacts/groups/g1','contactGroups','contactGroup','g1'],['/automations/flows/f1','chatbotFlows','flow','f1'],
    ['/zed-ai/agents/a1','zoeAi','agent','a1'],['/team-inbox/c1','messages','conversation','c1'],
    ['/whatsapp/numbers','whatsapp'],['/whatsapp/templates','templates'],['/settings/team','team'],['/settings/billing','billing'],['/analytics/ai','analytics'],['/automations/keywords','automations']
  ]){const route=parse(url);assert.equal(route.section,section);assert.equal(route.resourceId,id||null);assert.equal(route.resourceKind,kind||null);assert.equal(path(route),url);}
});
test('existing bookmarks preserve their resource when resolved to a new destination',()=>{
  for(const [old,next] of [['/broadcasts','/campaigns'],['/contact-groups/g1','/contacts/groups/g1'],['/chatbot-flows/f1','/automations/flows/f1'],['/zoe-ai/agents/a1','/zed-ai/agents/a1'],['/whatsapp-templates','/whatsapp/templates'],['/team-members','/settings/team']])assert.equal(path(parse(old)),next);
});
test('malformed, nested and unknown resource links are recoverable',()=>{
  for(const url of ['/zed-ai/agents/%','/team-inbox/%2fadmin','/no-such-page'])assert.equal(parse(url).invalid,true);
  assert.equal(parse('/').invalid,false);
});
