'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { runWorkflow } = require('./agent-workflow.js');

const profiles = ['orchestrator', 'frontend-developer', 'test-engineer', 'approvals-reviewer'];

function responseFor(agent, prompt) {
  if (agent === 'orchestrator') {
    return JSON.stringify({
      summary: 'Plan a small interface change.',
      acceptanceCriteria: ['The interface includes the requested action.'],
      tasks: [{ agent: 'frontend-developer', task: 'Design the interface change.', deliverable: 'A proposed interface design.' }]
    });
  }
  if (agent === 'frontend-developer') {
    return JSON.stringify({
      summary: 'Prepared a design proposal.',
      deliverable: 'Add a clearly labeled action to the interface.',
      assumptions: [],
      blockers: ['No workspace tool call was made in this mocked workflow.']
    });
  }
  if (agent === 'test-engineer') {
    const criterion = prompt.match(/Acceptance criteria:\n1\. (.+)/)[1];
    return JSON.stringify({
      verdict: 'needs_work',
      checks: [{ criterion, status: 'not_verified', evidence: 'The handoff proposes a change but no implementation was inspected.' }],
      testsRun: [],
      limitations: 'No workspace evidence or project check was supplied.'
    });
  }
  if (agent === 'approvals-reviewer') return 'Verdict: needs work. The proposal is unverified; inspect the implementation and run tests.';
  throw new Error('Unexpected agent: ' + agent);
}

test('workflow passes specialist handoffs through QA before final review', async () => {
  const calls = [];
  const stages = [];
  const result = await runWorkflow({
    task: 'Add a clearly labeled action to the interface.',
    profiles,
    ask: async (agent, prompt, rules) => {
      calls.push({ agent, prompt, rules });
      return responseFor(agent, prompt);
    },
    onStage: stage => stages.push(stage.stage)
  });

  assert.deepEqual(calls.map(call => call.agent), [
    'orchestrator', 'frontend-developer', 'test-engineer', 'approvals-reviewer'
  ]);
  assert.match(calls[2].prompt, /Prepared a design proposal/);
  assert.equal(result.qa.verdict, 'needs_work');
  assert.deepEqual(result.qa.testsRun, []);
  assert.match(result.summary, /unverified/);
  assert.deepEqual(stages, ['planning', 'specialist', 'qa', 'review', 'complete']);
  assert.match(calls[1].rules, /supplied workspace tools/);
});

test('workflow rejects a plan that selects a profile outside the available specialists', async () => {
  await assert.rejects(runWorkflow({
    task: 'Make a change.',
    profiles,
    ask: async agent => agent === 'orchestrator'
      ? JSON.stringify({
        summary: 'Plan.',
        acceptanceCriteria: ['A criterion.'],
        tasks: [{ agent: 'unknown-agent', task: 'Do work.', deliverable: 'A result.' }]
      })
      : ''
  }), /unavailable or reserved specialist profile/);
});

test('workflow rejects unsupported claims that tests were run', async () => {
  await assert.rejects(runWorkflow({
    task: 'Make a change.',
    profiles,
    ask: async (agent, prompt) => {
      if (agent === 'test-engineer') {
        const criterion = prompt.match(/Acceptance criteria:\n1\. (.+)/)[1];
        return JSON.stringify({
          verdict: 'pass',
          checks: [{ criterion, status: 'met', evidence: 'Claimed complete.' }],
          testsRun: ['npm test'],
          limitations: 'None.'
        });
      }
      return responseFor(agent, prompt);
    }
  }), /must not invent test results/);
});

test('workflow rejects a passing QA verdict when a criterion is unverified', async () => {
  await assert.rejects(runWorkflow({
    task: 'Make a change.',
    profiles,
    ask: async (agent, prompt) => {
      if (agent === 'test-engineer') {
        const criterion = prompt.match(/Acceptance criteria:\n1\. (.+)/)[1];
        return JSON.stringify({
          verdict: 'pass',
          checks: [{ criterion, status: 'not_verified', evidence: 'No workspace evidence was supplied.' }],
          testsRun: [],
          limitations: 'No workspace evidence or project check was supplied.'
        });
      }
      return responseFor(agent, prompt);
    }
  }), /cannot pass while any acceptance criterion is unmet or unverified/);
});

test('workflow extracts JSON when wrapped in markdown fences or conversational text', async () => {
  const result = await runWorkflow({
    task: 'Add a clearly labeled action to the interface.',
    profiles,
    ask: async (agent, prompt) => {
      if (agent === 'orchestrator') {
        return 'Here is the plan for this task:\n```json\n' + responseFor(agent, prompt) + '\n```\nHope that helps!';
      }
      if (agent === 'frontend-developer') {
        return 'Certainly, here is my handoff:\n' + responseFor(agent, prompt) + '\nBest regards!';
      }
      if (agent === 'test-engineer') {
        return '```\n' + responseFor(agent, prompt) + '\n```';
      }
      return responseFor(agent, prompt);
    }
  });
  assert.equal(result.plan.summary, 'Plan a small interface change.');
  assert.equal(result.qa.verdict, 'needs_work');
});
