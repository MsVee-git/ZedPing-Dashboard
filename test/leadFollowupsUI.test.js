import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/ZoeAI.tsx',import.meta.url),'utf8');
test('follow-up configuration retains saved settings and binds template lookup to selected number',()=>{
 assert.match(source,/followups:source.configuration\?\.followups/);
 assert.match(source,/\/templates\?whatsapp_number_id=/);
 assert.match(source,/draft\.whatsapp_number_id/);
 assert.match(source,/item.status==="APPROVED" && item.category==="MARKETING"/);
 assert.match(source,/\[24,72\]\.map/);
 assert.match(source,/then close at 96 hours/);
 assert.match(source,/source.configuration\?\.followups \|\| \{enabled:false\}/);
});
