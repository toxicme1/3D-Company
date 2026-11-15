'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { WorkflowApprovalQueue } = require('./workflow-approvals.js');

test('workflow approval remains pending until explicitly approved', async () => {
  const queue = new WorkflowApprovalQueue({ timeoutMs: 1000 });
  const value = { workflowId: 'wf-1' };
  const result = queue.wait('approval-1', value);
  assert.equal(queue.get('approval-1'), value);
  assert.equal(queue.resolve('approval-1', { approved: true, reason: '' }), true);
  assert.deepEqual(await result, { approved: true, reason: '' });
  assert.equal(queue.get('approval-1'), undefined);
});

test('workflow decline resolves without approval', async () => {
  const queue = new WorkflowApprovalQueue({ timeoutMs: 1000 });
  const result = queue.wait('approval-declined', {});
  assert.equal(queue.resolve('approval-declined', { approved: false, reason: 'Declined.' }), true);
  assert.deepEqual(await result, { approved: false, reason: 'Declined.' });
});

test('workflow approval timeout reports that no action was approved', async () => {
  const queue = new WorkflowApprovalQueue({ timeoutMs: 10 });
  let timedOut = false;
  const result = await queue.wait('approval-2', {}, () => { timedOut = true; });
  assert.deepEqual(result, { approved: false, reason: 'Approval expired; no action was performed.' });
  assert.equal(timedOut, true);
  assert.equal(queue.get('approval-2'), undefined);
});

test('workflow approval setup failures can cancel and reject a waiter', async () => {
  const queue = new WorkflowApprovalQueue({ timeoutMs: 1000 });
  const result = queue.wait('approval-3', {});
  assert.equal(queue.cancel('approval-3', new Error('Persistence failed.')), true);
  await assert.rejects(result, /Persistence failed/);
  assert.equal(queue.get('approval-3'), undefined);
});
