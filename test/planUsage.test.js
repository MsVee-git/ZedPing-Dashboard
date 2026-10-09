import test from 'node:test';
import assert from 'node:assert/strict';
import { proposedPlans, usageBalance } from '../src/lib/planUsage.js';
test('approved template allowances and starter AI exclusion', () => {
 assert.deepEqual(proposedPlans.map(p => p.templates), [1000,3000,5000]);
 assert.equal(proposedPlans[0].agents,0);
 assert.equal(proposedPlans[2].price,5000);
});
test('missing or incomplete usage never becomes a zero or full balance', () => {
 for (const value of [null, {}, {limit:1000,used:0}, {limit:1000,used:-1,periodStart:'a',periodEnd:'b'}]) assert.equal(usageBalance(value),null);
});
test('complete server snapshot clamps overspend and marks exhaustion', () => {
 const value=usageBalance({limit:1000,used:1200,periodStart:'2026-10-01',periodEnd:'2026-11-01'});
 assert.equal(value.remaining,0);assert.equal(value.percent,100);assert.equal(value.exhausted,true);
});
