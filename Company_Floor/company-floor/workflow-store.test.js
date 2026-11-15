'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { WorkflowStore } = require('./workflow-store.js');

test('workflow status persists and restores the latest real stage', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'company-floor-workflow-'));
  const file = path.join(dir, 'workflows.json');
  try {
    const first = new WorkflowStore(file);
    first.update('wf-1', 'ceo', { task: 'Review the UI', status: 'running', stage: 'specialist', activeAgent: 'frontend-developer' });
    const restored = first.all()[0];
    assert.equal(restored.stage, 'specialist');
    assert.equal(restored.activeAgent, 'frontend-developer');
    assert.equal(restored.task, 'Review the UI');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('workflow status marks interrupted runs failed after a bridge restart', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'company-floor-workflow-'));
  const file = path.join(dir, 'workflows.json');
  try {
    const first = new WorkflowStore(file);
    first.update('wf-1', 'ceo', { task: 'Review the UI', status: 'waiting_for_approval', stage: 'waiting_for_approval', approvalId: 'pending' });
    const restored = new WorkflowStore(file).all()[0];
    assert.equal(restored.status, 'failed');
    assert.equal(restored.approvalId, '');
    assert.match(restored.message, /restarted/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
