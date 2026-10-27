import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeInboxRows,sortInboxRows,subscribeInboxActivity} from '../src/lib/inboxActivity.js';
test('new outbound or inbound activity reorders cached chats and retains their contact details',()=>{
 const rows=[{id:'recent',last_message_at:'2026-10-27T10:00:00Z'},{id:'older',last_message_at:'2026-10-26T10:00:00Z',contacts:{name:'Lead'}}];
 for(const direction of ['inbound','outbound']){
 const next=mergeInboxRows(rows,[{id:'older',last_message_at:'2026-10-27T11:00:00Z',last_message:{direction,message_body:'Follow-up'}}]);
 assert.equal(next[0].id,'older');assert.equal(next[0].contacts.name,'Lead');assert.equal(next[0].last_message.direction,direction);assert.equal(rows[0].id,'recent');
 }
 assert.equal(sortInboxRows([{id:'null'},{id:'active',last_inbound_at:'2026-10-27T11:00:00Z'}])[0].id,'active');
});
test('late snapshots cannot move an updated chat down or replace newer activity',()=>{
 const rows=[{id:'chat',updated_at:'2026-10-27T12:00:00Z',last_message_at:'2026-10-27T12:00:00Z'}];
 assert.equal(mergeInboxRows(rows,[{id:'chat',updated_at:'2026-10-27T11:00:00Z',last_message_at:'2026-10-27T11:00:00Z'}])[0].last_message_at,rows[0].last_message_at);
});
test('subscriptions filter the authenticated workspace and remove channels on cleanup',()=>{
 const listeners=[],events=[];let removed=false,ready=false;
 const client={channel(name){assert.equal(name,'inbox-activity:mine');const channel={on(kind,filter,callback){assert.equal(filter.filter,'customer_id=eq.mine');listeners.push({filter,callback});return channel},subscribe(cb){cb('SUBSCRIBED');return channel}};return channel},removeChannel(){removed=true}};
 const close=subscribeInboxActivity(client,'mine',event=>events.push(event),()=>ready=true);
 listeners[0].callback({new:{id:'foreign',customer_id:'other'}});
 listeners[0].callback({new:{id:'chat',customer_id:'mine'}});
 listeners[1].callback({new:{id:'message',conversation_id:'chat',customer_id:'mine'}});
 assert.equal(events.length,2);assert.equal(events[1].conversationId,'chat');assert.equal(ready,true);close();assert.equal(removed,true);
});
