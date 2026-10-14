import test from 'node:test';
import assert from 'node:assert/strict';
import { csv, csvCell, summaryRows, campaignRows } from '../src/lib/lifetimeReportExport.js';
test('CSV preserves commas, quotes and line breaks and guards formulas',()=>{
 assert.equal(csvCell('Hello, "friend"\nNext'),'"Hello, ""friend""\nNext"');
 for(const s of ['=HYPERLINK("x")',' +1','-2','@SUM(1)','\tformula']) assert.ok(csvCell(s).startsWith('"\''));
 assert.equal(csvCell(null),'"Not available"');assert.equal(csvCell(0),'"0"');
 assert.ok(csv([['Metric','Value'],['Total',2]]).startsWith('\uFEFF'));
});
const report={scope:'period',period:{start_inclusive:'2026-09-01T00:00:00Z',end_exclusive:'2026-10-01T00:00:00Z'},workspace_id:'a',generated_at:'2026-10-14T12:00:00Z',messages:{total:123,inbound:30,outbound:93,other_direction:0,recorded_correspondents:12,outbound_statuses:{accepted:20},first_recorded_at:null,last_recorded_at:null},current:{contacts:20,conversations:12,automations:2},broadcasts:{total:1,statuses:{scheduled:1},campaigns:[{id:'c',name:'=SUM(1)',status:'scheduled',accepted:null,failed:0,recorded_recipients:2}]},unavailable:['Verified delivery/read rates'],definitions:['Retained records']};
test('summary and campaign exports retain scope, cutoff, missing values and recorded zeros',()=>{
 assert.equal(summaryRows(report).find(r=>r[0]==='Recorded messages')[1],123);
 const rows=campaignRows(report);assert.equal(rows[1][0],'a');assert.equal(rows[1][1],report.generated_at);assert.equal(rows[1][rows[0].indexOf('Recorded accepted')],null);assert.equal(rows[1][rows[0].indexOf('Recorded failed')],0);
 assert.equal(rows[1][rows[0].indexOf('Period start UTC')],report.period.start_inclusive);assert.equal(rows[1][rows[0].indexOf('Period end UTC')],report.period.end_exclusive);
 assert.ok(csv(rows).includes('"Not available"'));assert.ok(csv(rows).includes('"\'=SUM(1)"'));
});

test('exports receipt coverage, unknown history and unavailable campaign evidence distinctly',()=>{
 const r={...report,delivery:{delivered:2,read:1,failed:0,sent_pending:1,accepted_pending:1,unconfirmed:40,submission_failures:0,failure_reasons:{},first_receipt_at:null,last_receipt_at:null}}
 const summary=summaryRows(r)
 assert.equal(summary.find(row=>row[0]==='Unconfirmed legacy messages')[1],40)
 assert.equal(summary.find(row=>row[0]==='Provider failed')[1],0)
 const campaigns=campaignRows(r)
 assert.equal(campaigns[1][campaigns[0].indexOf('Delivered (includes read)')],undefined)
 assert.ok(csv(campaigns).includes('Not available'))
})
