'use strict';

const MAX_TURNS = 16;
const MAX_TOOLS_PER_TURN = 4;
const MAX_TOOL_CALLS = 40;
const MAX_TOOL_OUTPUT = 120000;

async function runWorkflowToolLoop(options) {
  const { agent, messages, toolDefinitions, complete, execute, context } = options;
  const stage = agent === 'orchestrator' ? 'planning' : agent === 'test-engineer' ? 'qa' :
    agent === 'approvals-reviewer' ? 'review' : 'specialist';
  const toolIds = new Set();
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    context.updateStatus({
      status: 'running',
      stage,
      activeAgent: agent,
      approvalId: '',
      message: agent + (turn ? ' is reviewing tool results.' : ' is working on its handoff.')
    });
    const response = await complete(messages, toolDefinitions);
    if (!Array.isArray(response.toolCalls)) throw new Error('The model returned invalid workspace tool calls.');
    if (!response.toolCalls.length) {
      if (typeof response.text !== 'string' || !response.text.trim()) {
        throw new Error(agent + ' ended without a text handoff.');
      }
      return response.text.trim();
    }
    if (response.toolCalls.length > MAX_TOOLS_PER_TURN) {
      throw new Error('The model requested too many workspace tools at once.');
    }
    messages.push({ role: 'assistant', content: response.text || null, tool_calls: response.toolCalls });
    for (const call of response.toolCalls) {
      if (context.toolCalls >= MAX_TOOL_CALLS) throw new Error('Workflow reached its workspace tool-call limit.');
      context.toolCalls++;
      if (!call || call.type !== 'function' || !call.function || typeof call.function.name !== 'string' ||
          typeof call.function.arguments !== 'string' || call.function.arguments.length > 50000 ||
          typeof call.id !== 'string' || !call.id || call.id.length > 200) {
        throw new Error('The model returned an invalid workspace tool call.');
      }
      if (toolIds.has(call.id)) throw new Error('The model reused a workspace tool-call ID.');
      toolIds.add(call.id);
      let args;
      try { args = JSON.parse(call.function.arguments); } catch (error) {
        throw new Error('The model returned invalid JSON for a workspace tool call.');
      }
      const outputText = JSON.stringify(await execute(call.function.name, args));
      if (typeof outputText !== 'string') throw new Error('Workspace tool returned a non-JSON result.');
      context.toolOutputChars += outputText.length;
      if (context.toolOutputChars > MAX_TOOL_OUTPUT) throw new Error('Workflow reached its workspace context limit.');
      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: outputText.slice(0, 24000)
      });
    }
  }
  throw new Error(agent + ' exceeded the 16-turn tool limit.');
}

module.exports = { runWorkflowToolLoop };
