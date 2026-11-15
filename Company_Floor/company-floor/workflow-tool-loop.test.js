'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { runWorkflowToolLoop } = require('./workflow-tool-loop.js');

function context(toolCalls) {
  return {
    toolCalls: toolCalls || 0,
    toolOutputChars: 0,
    updateStatus() {}
  };
}

test('workflow tool loop returns the handoff after appending tool evidence', async () => {
  const messages = [];
  const calls = [];
  const ctx = context();
  const handoff = await runWorkflowToolLoop({
    agent: 'frontend-developer',
    messages,
    toolDefinitions: [],
    context: ctx,
    complete: async current => current.some(message => message.role === 'tool')
      ? { text: 'Finished handoff.', toolCalls: [] }
      : { text: '', toolCalls: [{
        id: 'call-1',
        type: 'function',
        function: { name: 'read_workspace_file', arguments: '{"path":"src/app.js"}' }
      }] },
    execute: async (name, args) => {
      calls.push({ name, args });
      return { content: 'source' };
    }
  });
  assert.equal(handoff, 'Finished handoff.');
  assert.deepEqual(calls, [{ name: 'read_workspace_file', args: { path: 'src/app.js' } }]);
  assert.equal(ctx.toolCalls, 1);
  assert.deepEqual(messages.map(message => message.role), ['assistant', 'tool']);
});

test('workflow tool loop enforces the shared call limit before execution', async () => {
  const ctx = context(40);
  let executed = false;
  await assert.rejects(runWorkflowToolLoop({
    agent: 'frontend-developer',
    messages: [],
    toolDefinitions: [],
    context: ctx,
    complete: async () => ({ text: '', toolCalls: [{
      id: 'call-1',
      type: 'function',
      function: { name: 'list_workspace_files', arguments: '{}' }
    }] }),
    execute: async () => { executed = true; return {}; }
  }), /workspace tool-call limit/);
  assert.equal(executed, false);
});

test('workflow tool loop rejects malformed and duplicate tool calls', async () => {
  const malformed = {
    id: 'call-1',
    type: 'function',
    function: { name: 'list_workspace_files', arguments: '{' }
  };
  await assert.rejects(runWorkflowToolLoop({
    agent: 'orchestrator',
    messages: [],
    toolDefinitions: [],
    context: context(),
    complete: async () => ({ text: '', toolCalls: [malformed] }),
    execute: async () => ({})
  }), /invalid JSON/);

  const duplicate = Object.assign({}, malformed, {
    function: { name: 'list_workspace_files', arguments: '{}' }
  });
  await assert.rejects(runWorkflowToolLoop({
    agent: 'orchestrator',
    messages: [],
    toolDefinitions: [],
    context: context(),
    complete: async () => ({ text: '', toolCalls: [duplicate, duplicate] }),
    execute: async () => ({})
  }), /reused a workspace tool-call ID/);
});
