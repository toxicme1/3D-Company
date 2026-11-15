'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const brain = require('./company-brain.json');
const { ceoAnswer, findPeople, parseSummonCommand } = require('./agent-brain.js');

test('CEO answers roster count and employee role questions from the directory', () => {
  const context = { people: brain.people };
  assert.match(ceoAnswer(brain, context, 'How many agents do you have?', { intent: 'question' }), /80 people in Company Floor/);
  assert.match(ceoAnswer(brain, context, 'What does Amina do?', { intent: 'question' }), /Amina is Head of Front End Dev in Front End Dev/);
});

test('CEO directory supports listing all employees and roles', () => {
  const answer = ceoAnswer(brain, { people: brain.people }, 'List all employees and their roles', { intent: 'question' });
  assert.match(answer, /Amina — Head of Front End Dev, Front End Dev/);
  assert.match(answer, /Umar — Sign-off Agent, Review & Approvals/);
});

test('summon commands resolve exact employees, roles, and office heads', () => {
  const employee = parseSummonCommand('Could you call Amina to your office?');
  assert.equal(findPeople(brain.people, employee)[0].name, 'Amina');
  const secondForm = parseSummonCommand('Bring Amina into the CEO office');
  assert.equal(findPeople(brain.people, secondForm)[0].name, 'Amina');
  const officeHead = parseSummonCommand('Call the QA & Testing team into your office');
  assert.equal(findPeople(brain.people, officeHead)[0].name, 'Ethan');
  assert.equal(parseSummonCommand('Summon Amina'), 'Amina');
});

test('ordinary meeting requests are not mistaken for employee summons', () => {
  const target = parseSummonCommand('Call a meeting about the API');
  assert.equal(findPeople(brain.people, target).length, 0);
});
