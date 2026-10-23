import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignStatus,campaignReceipt} from '../src/lib/campaignStatus.js';

test('saved completed campaign keeps its Sent receipt after reopening, regardless of delivery failures',()=>{
  const saved={status:'completed',sent_count:395,failed_count:0,delivery:{delivered:212,failed:139}};
  const reopened=JSON.parse(JSON.stringify(saved));
  assert.equal(campaignStatus(reopened).label,'Sent');
  assert.deepEqual(campaignReceipt(reopened),{accepted:395,failed:0});
});
test('sending campaign never shows a completion receipt',()=>{
  assert.equal(campaignStatus({status:'sending'}).label,'Sending');
  assert.equal(campaignReceipt({status:'sending',sent_count:10,failed_count:0}),null);
});
test('mixed and failed submissions have accurate completion labels',()=>{
  assert.equal(campaignStatus({status:'completed',sent_count:8,failed_count:2}).label,'Partially sent');
  assert.equal(campaignStatus({status:'completed',sent_count:0,failed_count:10}).label,'Not sent');
  assert.equal(campaignStatus({status:'failed'}).label,'Failed');
});
test('historical missing counts are never presented as confirmed zero submissions',()=>{
  assert.equal(campaignReceipt({status:'completed'}),null);
  assert.equal(campaignReceipt({status:'completed',sent_count:null,failed_count:null}),null);
});
