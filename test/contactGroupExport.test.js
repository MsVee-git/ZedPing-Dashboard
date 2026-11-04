import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareContactGroupExport, downloadContactGroupExport} from '../src/lib/contactGroupExport.js';
const group={id:'group-a',name:'Ford enquiries'};
const member=(id,phone,name='Customer')=>({contact_id:id,contact:{id,name,phone_number:phone,tag:'Warm'}});
test('exports the complete fresh segment beyond 1,000 contacts through its scoped members endpoint',async()=>{
 const members=Array.from({length:1205},(_,i)=>member(String(i),`+26097${String(i).padStart(7,'0')}`));
 let path;
 const file=await prepareContactGroupExport(async p=>{path=p;return {group,members}},group,'csv');
 assert.equal(path,'/group-a/members');
 assert.equal(file.count,1205);assert.equal(file.filename,'Ford_enquiries_contacts.csv');
 assert.ok(file.content.startsWith('\uFEFF"Name","Phone","Tag","Group"'));
 assert.ok(file.content.includes(members.at(-1).contact.phone_number));
});
test('CSV retains Unicode, quotes and line breaks and prevents spreadsheet formula execution',async()=>{
 const file=await prepareContactGroupExport(async()=>({group,members:[member('a','+260978748066','=HYPERLINK("bad")'),member('b','260970000000','Chishimba, “Vee”\nNext')]}),group,'csv');
 assert.ok(file.content.includes('"\'=HYPERLINK(""bad"")"'));
 assert.ok(file.content.includes('"\'+260978748066"'));
 assert.ok(file.content.includes('"Chishimba, “Vee”\nNext"'));
});
test('TXT has phone numbers only, retains plus signs and removes repeated numbers',async()=>{
 const file=await prepareContactGroupExport(async()=>({group:{...group,name:'../A/B'},members:[member('a','+260978748066'),member('b','+260978748066'),member('c','')]}),group,'txt');
 assert.equal(file.content,'+260978748066\r\n');assert.equal(file.count,1);
 assert.equal(file.filename,'A_B_contacts.txt');assert.ok(!file.content.includes('Customer'));
});
test('empty, invalid and denied exports fail instead of downloading misleading empty files',async()=>{
 await assert.rejects(prepareContactGroupExport(async()=>({members:[]}),group,'csv'),/no contacts/);
 await assert.rejects(prepareContactGroupExport(async()=>({error:'Unavailable'}),group,'csv'),/Could not load/);
 await assert.rejects(prepareContactGroupExport(async()=>{throw new Error('Forbidden')},group,'csv'),/Forbidden/);
 await assert.rejects(prepareContactGroupExport(async()=>({members:[member('a','')]}),group,'txt'),/no phone/);
 await assert.rejects(prepareContactGroupExport(()=>{},group,'html'),/format/);
});
test('download creates a real file link and cleans it up',()=>{
 const originalDocument=globalThis.document;
 const create=URL.createObjectURL,revoke=URL.revokeObjectURL,timer=globalThis.setTimeout;
 let clicked=false,removed=false,attached=false,revoked=false,blob;
 const link={click(){clicked=true},remove(){removed=true}};
 try {
  globalThis.document={createElement:type=>{assert.equal(type,'a');return link},body:{appendChild:()=>{attached=true}}};
  URL.createObjectURL=value=>{blob=value;return 'blob:test'};URL.revokeObjectURL=url=>{assert.equal(url,'blob:test');revoked=true};globalThis.setTimeout=fn=>fn();
  downloadContactGroupExport({content:'+260978748066\r\n',type:'text/plain;charset=utf-8',filename:'Ford_contacts.txt'});
  assert.equal(link.download,'Ford_contacts.txt');assert.equal(link.href,'blob:test');assert.ok(blob instanceof Blob);
  assert.ok(clicked&&removed&&attached&&revoked);
 } finally {globalThis.document=originalDocument;URL.createObjectURL=create;URL.revokeObjectURL=revoke;globalThis.setTimeout=timer}
});
