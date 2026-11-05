import test from 'node:test';import assert from 'node:assert/strict';import {messageDeliveryState as state} from '../src/lib/messageDeliveryState.js';
test('only authoritative outbound read receipts get blue double ticks',()=>{
 assert.deepEqual(state({direction:'outbound',status:'read'}),{label:'Read',ticks:2,read:true});
 for(const status of ['delivered','sent','accepted','queued','failed',null])assert.notEqual(state({direction:'outbound',status}).read,true);
 assert.equal(state({direction:'inbound',status:'read'}),null);
 assert.equal(state({direction:'outbound',status:'delivered'}).ticks,2);assert.equal(state({direction:'outbound',status:'sent'}).ticks,1);
 assert.equal(state({direction:'outbound',status:'failed'}).label,'Failed');
});
