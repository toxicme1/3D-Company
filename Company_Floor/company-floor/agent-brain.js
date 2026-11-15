/*
 * Company Brain: decides what an employee does with a message.
 *
 * Pure functions, no DOM. Works in the Company Floor page (window.CompanyBrain),
 * in Node (require('./agent-brain.js')) and on a real backend.
 *
 *   var out = CompanyBrain.reason(brain, ctx, text, opts)
 *
 *   brain  company-brain.json (offices, roles, keywords, people)
 *   ctx    { agent: person, people: [person], away: bool, task: {text} | null, stateLabel: 'Coding' }
 *   person { id, name, role, office, officeIdx, roleIdx, isHead }
 *   opts   { att: 'photo' | 'file' | 'voice note', rand: function }
 *
 * Returns { intent, steps[], decision, reply, why, work, accept, handoff, done, log, snippet }
 *   steps    the reasoning, one line each: who am I, what was asked, is it my job, next move
 *   decision 'chat' | 'status' | 'accept' | 'delegate' | 'redirect' | 'clarify'
 *   work     the work state the avatar should switch to AFTER the reasoning
 *   handoff  { id, state, text, from, does, done } when the request is passed to someone else
 *
 * Plans (head -> CEO -> user -> offices):
 *   var prop = CompanyBrain.propose(brain, headPerson, task, line)      each office head sends this to the CEO
 *   var plan = CompanyBrain.consolidate(brain, [prop...], task, notes)  the CEO merges them into ONE plan (plan.text is what the user reads)
 *   The visual office simulation waits for approval; it does not dispatch real work.
 */
(function (root) {
  'use strict';

  var INTENT_LABEL = { greeting: 'a greeting', thanks: 'a thank you', status: 'a status check', question: 'a question', task: 'a request for work', chat: 'a short message' };

  function norm(t) { return ' ' + String(t || '').toLowerCase().replace(/[^a-z0-9+#;.\- ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' '; }
  function short(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 3) + '...' : t; }
  function pick(arr, rand) { return arr[Math.floor(rand() * arr.length)]; }

  // keyword match: prefix match for long words, whole-word for very short ones (ci, db, pr)
  function has(text, kw) {
    var k = kw.toLowerCase();
    if (k.length <= 3) return text.indexOf(' ' + k + ' ') >= 0 || text.indexOf(' ' + k + 's ') >= 0;
    return text.indexOf(' ' + k) >= 0;
  }
  // multi-word keywords are stronger evidence than single words
  function hits(text, kws) {
    var n = 0, found = [];
    for (var i = 0; i < kws.length; i++) if (has(text, kws[i])) { n += kws[i].indexOf(' ') >= 0 ? 2 : 1; found.push(kws[i]); }
    return { n: n, found: found };
  }

  function classify(text) {
    var t = norm(text), words = t.trim().split(' ').filter(Boolean).length;
    var task = /( build | make | create | fix | add | write | draft | test | review | deploy | check | find | update | implement | design | prepare | run | set up | setup | investigate | summari[sz]e | look into | handle | work on | start | need | please | can you | could you | help )/.test(t);
    if (words <= 5 && /^ (hi|hello|hey|yo|howdy|sup|good morning|good afternoon|good evening)( |$)/.test(t) && !task) return 'greeting';
    if (words <= 9 && /(thanks|thank you|great job|well done|nice work|cheers|appreciate)/.test(t) && !task) return 'thanks';
    if (/(status|progress|update on|how is it going|how's it going|done yet|any news|where are we|are you done|finished yet)/.test(t)) return 'status';
    if (/\?/.test(t) || /^ (what|why|how|when|where|who|which|can|could|do|does|is|are|should|would) /.test(t)) return task ? 'task' : 'question';
    if (task || words >= 3) return 'task';
    return 'chat';
  }

  function roleOf(brain, p) { return brain.roles[p.officeIdx][p.roleIdx]; }
  function roleLine(p) { return p.isHead ? p.role : p.role + ' in ' + p.office; }
  // what I do, in first person: heads lead their office and also do their own role
  function dutyOf(brain, p) { var r = roleOf(brain, p); return p.isHead ? 'lead ' + p.office + ' and ' + r.duty : r.duty; }

  function bestOffice(brain, t, excludeIdx) {
    var best = { idx: -1, n: 0, found: [] };
    brain.offices.forEach(function (o, i) {
      if (i === excludeIdx) return;
      var h = hits(t, o.kw), roleN = 0;
      brain.roles[i].forEach(function (r) { roleN += hits(t, r.kw).n; });
      var n = h.n + roleN;
      if (n > best.n) best = { idx: i, n: n, found: h.found };
    });
    return best;
  }

  // the person whose own role matches the text best (inside one office, or across `people` when officeIdx is null)
  function bestPerson(brain, people, text, officeIdx, excludeId) {
    var t = text.charAt(0) === ' ' ? text : norm(text), best = { person: null, n: 0, found: [] };
    people.forEach(function (p) {
      if (p.id === excludeId || (officeIdx !== null && p.officeIdx !== officeIdx)) return;
      var h = hits(t, roleOf(brain, p).kw);
      if (h.n > best.n) best = { person: p, n: h.n, found: h.found };
    });
    return best;
  }

  function headOf(people, officeIdx) { return people.filter(function (p) { return p.officeIdx === officeIdx && p.isHead; })[0] || null; }

  function parseSummonCommand(text) {
    var match = /^\s*(?:(?:please|can you|could you)\s+)?(?:call|bring|invite|summon)\s+(.+?)(?:\s+(?:to|into|in)\s+(?:(?:the|your|his|my)\s+)?(?:CEO(?:'s)?\s+)?office)?[.!?]*\s*$/i.exec(String(text || ''));
    return match ? match[1].replace(/^(?:the|a|an)\s+/i, '').trim() : null;
  }

  function findPeople(people, query) {
    var key = norm(query).trim().replace(/^(?:the|a|an) /, '').replace(/ (?:team|office)$/, '');
    if (!key) return [];
    var byName = people.filter(function (p) { return norm(p.name).trim() === key; });
    if (byName.length) return byName;
    var byRole = people.filter(function (p) { return norm(p.role).trim() === key; });
    if (byRole.length) return byRole;
    var byOfficeHead = people.filter(function (p) { return p.isHead && norm(p.office).trim() === key; });
    return byOfficeHead;
  }

  function reason(brain, ctx, text, opts) {
    opts = opts || {};
    var rand = opts.rand || Math.random, me = ctx.agent, people = ctx.people || [];
    var R = roleOf(brain, me), O = brain.offices[me.officeIdx];
    var t = norm(text), words = t.trim().split(' ').filter(Boolean).length;
    var intent = classify(text), snippet = short(text, 46);
    var pre = (opts.att ? 'Got the ' + opts.att + '. ' : '') + (ctx.away ? 'Just getting back to my desk. ' : '');
    var out = { intent: intent, steps: [], decision: 'chat', reply: '', work: 'thinking', accept: false, handoff: null, done: null, log: '', why: '', snippet: snippet };
    var s = out.steps;

    s.push({ h: 'Who am I', t: 'I am ' + me.name + ', ' + roleLine(me) + '.' });
    s.push({ h: 'What was asked', t: INTENT_LABEL[intent] + (words > 1 ? ': "' + snippet + '"' : '') });

    if (intent === 'greeting' || intent === 'chat') {
      s.push({ h: 'Is it my job', t: 'No work requested, just a hello.' });
      s.push({ h: 'Next move', t: 'Say hi and explain what I can help with.' });
      out.decision = 'chat'; out.work = ctx.stateAfter || 'thinking';
      out.reply = pre + pick(['Hi! ', 'Hello! ', 'Hey! '], rand) + me.name + ' here. I am ' + roleLine(me) + ' and I ' + dutyOf(brain, me) + '. What do you need?';
      out.log = 'chatted with you';
    } else if (intent === 'thanks') {
      s.push({ h: 'Is it my job', t: 'No work requested.' });
      s.push({ h: 'Next move', t: 'Acknowledge and carry on.' });
      out.decision = 'chat'; out.work = ctx.stateAfter || 'thinking';
      out.reply = pre + pick(['Anytime.', 'Glad to help.', 'Happy to.'], rand) + ' Tell me if anything else comes up for ' + me.office + '.';
      out.log = 'was thanked';
    } else if (intent === 'status') {
      s.push({ h: 'Is it my job', t: ctx.task ? 'Yes, I am working on "' + ctx.task.text + '".' : 'I have nothing assigned right now.' });
      s.push({ h: 'Next move', t: 'Report honestly where I am.' });
      out.decision = 'status'; out.work = ctx.stateAfter || 'thinking';
      out.reply = pre + (ctx.task ? 'Still on "' + ctx.task.text + '". Next up: ' + R.does + '. I will message you when it is done.'
        : 'Nothing assigned to me right now. I am ' + String(ctx.stateLabel || 'free').toLowerCase() + ' and ready for work in ' + me.office + '.');
      out.log = 'gave a status update';
    } else {
      // question or request: decide whose job it is
      var mine = hits(t, R.kw), mineO = hits(t, O.kw), other = bestOffice(brain, t, me.officeIdx);
      var colleague = bestPerson(brain, people, t, me.officeIdx, me.id), roleSum = 0;
      brain.roles[me.officeIdx].forEach(function (r) { roleSum += hits(t, r.kw).n; });
      var myScore = mineO.n + roleSum + mine.n;  // same measure bestOffice uses for other offices, plus extra weight for my own role
      var tgt, tr, branch;
      if (other.n > myScore && other.n > 0) branch = 'external';
      else if (me.isHead && colleague.person && colleague.n > mine.n) branch = 'internal';
      else if (mine.n > 0) branch = 'mine';
      else if (mineO.n > 0 || colleague.n > 0 || me.isHead) branch = colleague.person && colleague.n > 0 ? 'internal' : (mineO.n > 0 ? 'mine' : 'clarify');
      else if (other.n > 0) branch = 'external';
      else branch = 'clarify';

      if (branch === 'mine') {
        s.push({ h: 'Is it my job', t: mine.n ? 'Yes. It matches my duties (' + mine.found.join(', ') + ').' : 'It belongs to my office and nobody on my team fits better.' });
        s.push({ h: 'Next move', t: 'I will ' + R.does + '.' });
        out.decision = 'accept'; out.accept = true; out.work = R.state; out.done = R.done; out.log = 'took the request: ' + snippet;
        out.reply = pre + pick(['On it. ', 'Understood. ', 'Got it. '], rand) + 'This is my area as ' + me.role + ': I ' + R.duty + '. Next I will ' + R.does + '. I will message you when it is done.';
      } else if (branch === 'internal') {
        tgt = colleague.person; tr = roleOf(brain, tgt);
        s.push({ h: 'Is it my job', t: 'It is in ' + me.office + ', but ' + tgt.name + ' (' + tgt.role + ') is the better fit (' + colleague.found.join(', ') + ').' });
        s.push({ h: 'Next move', t: (me.isHead ? 'Assign it to ' : 'Pass it to ') + tgt.name + ' and keep you posted.' });
        out.decision = 'delegate'; out.work = 'thinking'; out.log = 'passed your request to ' + tgt.name;
        out.handoff = { id: tgt.id, state: tr.state, text: snippet, from: me.name, fromRole: me.role, does: tr.does, done: tr.done };
        out.reply = pre + (me.isHead ? 'I will assign this to ' : 'That is more ') + (me.isHead ? tgt.name + ' (' + tgt.role + ') and review the result.' : tgt.name + "'s area (" + tgt.role + '). I am passing it to them now.') + ' They will message you directly.';
      } else if (branch === 'external') {
        var oo = brain.offices[other.idx], head = headOf(people, other.idx), byRole = bestPerson(brain, people, t, other.idx, null);
        tgt = byRole.person && byRole.n > 0 ? byRole.person : head; tr = tgt ? roleOf(brain, tgt) : null;
        s.push({ h: 'Is it my job', t: 'No. As ' + me.role + ' I ' + dutyOf(brain, me) + '. This sits with ' + oo.name + (other.found.length ? ' (' + other.found.join(', ') + ')' : '') + '.' });
        s.push({ h: 'Next move', t: tgt ? 'Hand it to ' + tgt.name + ' (' + tgt.role + ') and tell you.' : 'Tell you which office owns it.' });
        out.decision = 'redirect'; out.work = 'thinking'; out.log = 'redirected your request to ' + oo.name;
        if (tgt) out.handoff = { id: tgt.id, state: tr.state, text: snippet, from: me.name, fromRole: me.role, does: tr.does, done: tr.done };
        out.reply = pre + 'That is outside my role as ' + me.role + '. It belongs to ' + oo.name + (tgt ? ', so I am passing it to ' + tgt.name + ' (' + tgt.role + ')' + (head && head.id !== tgt.id ? '. ' + head.name + ' leads that office.' : '.') + ' They will message you directly.' : '.');
      } else {
        s.push({ h: 'Is it my job', t: 'I cannot tell how this fits my role as ' + me.role + '.' });
        s.push({ h: 'Next move', t: 'Ask what outcome you need before starting.' });
        out.decision = 'clarify'; out.work = 'thinking'; out.log = 'asked you to clarify';
        out.reply = pre + 'I am ' + roleLine(me) + ' and I ' + dutyOf(brain, me) + '. I am not sure how that fits. ' + (me.isHead ? 'Tell me the goal and I will route it to the right person on my team.' : 'What outcome do you need, and by when?');
      }
    }

    out.why = s.map(function (x) { return x.t; }).slice(2).join(' ');
    return out;
  }


  // ---- plans: heads send proposals to the CEO, the CEO sends the user ONE plan ----
  var DEFAULT_STAGES = [
    { name: 'Prepare', offices: ['Research Agents', 'Design & UX', 'Orchestrator', 'Memory & Context'] },
    { name: 'Build', offices: ['Back End Dev', 'Front End Dev', 'Data & Analytics', 'Skill Management', 'MCP Management'] },
    { name: 'Verify', offices: ['QA & Testing', 'Security'] },
    { name: 'Ship', offices: ['DevOps'] }
  ];
  function stageIdx(stages, officeName) {
    for (var i = 0; i < stages.length; i++) if (stages[i].offices.indexOf(officeName) >= 0) return i;
    return 1; // unknown offices (new ones) build by default
  }
  // which offices the CEO calls for a task: keyword matches plus the always-on offices (max 11 = meeting room seats)
  function relevantOffices(brain, task) {
    var t = norm(task), always = brain.alwaysOn || [], list = [];
    brain.offices.forEach(function (o, i) {
      var n = hits(t, o.kw).n;
      brain.roles[i].forEach(function (r) { n += hits(t, r.kw).n; });
      var a = always.indexOf(o.name) >= 0;
      if (n > 0 || a) list.push({ i: i, s: n + (a ? 1000 : 0) });
    });
    if (list.length < 5) brain.offices.forEach(function (o, i) { if ((o.name === 'Orchestrator' || o.name === 'Research Agents') && !list.some(function (x) { return x.i === i; })) list.push({ i: i, s: 0 }); });
    list.sort(function (a, b) { return b.s - a.s; });
    return list.slice(0, 11).map(function (x) { return x.i; }).sort(function (a, b) { return a - b; });
  }
  // what one office head tells the CEO
  function propose(brain, head, task, line) {
    var R = roleOf(brain, head);
    return { officeIdx: head.officeIdx, office: head.office, ownerId: head.id, owner: head.name, role: R.role,
      line: line || R.does, team: brain.roles[head.officeIdx].map(function (r) { return r.role; }), task: task };
  }
  // what the CEO sends the user: one plan, grouped by stage, with risks
  function consolidate(brain, proposals, task, notes) {
    var defs = brain.stages || DEFAULT_STAGES, NL = String.fromCharCode(10), have = {};
    var stages = defs.map(function (s) { return { name: s.name, items: [] }; });
    proposals.slice().sort(function (a, b) { return a.officeIdx - b.officeIdx; }).forEach(function (p) {
      stages[stageIdx(defs, p.office)].items.push(p); have[p.office] = true;
    });
    stages = stages.filter(function (s) { return s.items.length; });
    var risks = [];
    ['QA & Testing', 'Security', 'Review & Approvals'].forEach(function (o) { if (!have[o] && brain.offices.some(function (x) { return x.name === o; })) risks.push(o + ' is not part of this plan, so that check is skipped.'); });
    if (stages.length > 1) risks.push('Stages run in order, so a delay in ' + stages[0].name + ' moves everything after it.');
    notes = notes || [];
    var lines = ['Plan for "' + short(task, 50) + '" (' + proposals.length + ' of ' + brain.offices.length + ' offices involved)'];
    stages.forEach(function (s, i) {
      lines.push('', (i + 1) + '. ' + s.name);
      s.items.forEach(function (p) { lines.push('- ' + p.office + ' (' + p.owner + '): ' + p.line); });
    });
    var skipped = brain.offices.filter(function (o) { return !have[o.name]; }).map(function (o) { return o.name; });
    if (skipped.length) lines.push('', 'Not involved this time: ' + skipped.join(', ') + '.');
    if (risks.length) lines.push('', 'Risks: ' + risks.join(' '));
    if (notes.length) lines.push('', 'Your changes: ' + notes.join('; '));
    lines.push('', 'The office simulation starts only after approval; it does not run real work. Reply yes to start the simulation, no to hold, or tell me what to change.');
    return { task: task, notes: notes, stages: stages, risks: risks, offices: proposals.length, text: lines.join(NL) };
  }

  // ---------- CEO decision: call a meeting, or just answer ----------
  // Pure function. The page and the bridge both call it, so the rule lives in one place.
  //   ceoDecide(brain, ctx, text) -> { kind, intent, why, reply, office, steps }
  //   kind  'meeting'  start a project: call the heads of the offices that matter
  //         'answer'   reply in the CEO chat, no meeting
  //         'clarify'  ask one short question first, no meeting
  //   ctx   { people: [person], project: {task, phase, approval, heads, done} | null, queued: n, working: n, idle: n }
  var WORK_VERB = /\b(build|make|create|fix|add|write|draft|implement|design|prepare|set ?up|deploy|ship|launch|migrate|refactor|integrate|develop|code|test|review|audit|investigate|research|analy[sz]e|plan|rebuild|redesign|optimi[sz]e|automate|install|configure|connect|generate|update|upgrade|remove|delete|improve|clean ?up|document)\b/i;
  var MEETING_WORDS = /\b(call (a |the )?(meeting|heads|everyone)|all[- ]hands|gather (the )?(heads|team|everyone)|team meeting|kick ?off|stand ?up|sync with (the )?(heads|offices)|brief (the )?(heads|offices))\b/i;
  var ANSWER_ASK = /^(what|why|how|when|where|who|which|is|are|do|does|did|should|would|could|can|will|tell me|explain|remind me|show me|list|summari[sz]e)\b/i;
  var OPINION = /\b(what do you think|your (opinion|view|take)|do you think|would you recommend|which is better|pros and cons|advice|thoughts on|should we)\b/i;
  var POLITE_TASK = /^(can|could|would|will) you\b.*\b(build|make|create|fix|add|write|draft|implement|design|prepare|set ?up|deploy|launch|migrate|refactor|integrate|develop|test|review|audit|investigate|research|rebuild|redesign|install|configure|connect|generate|update|upgrade|improve|document)\b/i;

  function ceoDecide(brain, ctx, text) {
    ctx = ctx || {}; var raw = String(text || '').trim(), q = raw.toLowerCase(), t = norm(raw);
    var words = t.trim().split(' ').filter(Boolean), n = words.length, people = ctx.people || [];
    var out = { kind: 'answer', intent: 'chat', why: '', reply: '', office: null, steps: [] };
    function step(h, x) { out.steps.push({ h: h, t: x }); }
    function head(idx) { var h = headOf(people, idx); return h ? h.name : 'its head'; }
    step('What was asked', '"' + short(raw, 60) + '"');

    // 1. explicit commands always win
    if (/^\/(task|project|meeting)\b/i.test(raw)) { var body = raw.replace(/^\/\w+\s*/, ''); out.kind = body.split(/\s+/).filter(Boolean).length >= 2 ? 'meeting' : 'clarify'; out.intent = 'task'; out.why = 'You used a /command.'; if (out.kind === 'clarify') out.reply = 'What should the meeting be about? Give me one line, for example: "/task build a login page".'; step('Decision', out.kind === 'meeting' ? 'Explicit command: call the heads.' : 'Command had no task text: ask for it.'); return out; }
    if (/^\/(ask|answer)\b/i.test(raw)) { out.intent = 'question'; out.why = 'You used /ask.'; step('Decision', 'Explicit command: answer, no meeting.'); out.reply = null; return out; }
    if (MEETING_WORDS.test(raw)) { out.kind = 'meeting'; out.intent = 'task'; out.why = 'You asked for a meeting.'; step('Decision', 'You asked for a meeting: call the heads.'); return out; }

    var base = classify(raw), best = bestOffice(brain, t, -1), work = WORK_VERB.test(raw), polite = POLITE_TASK.test(raw);
    if (best.n > 0) out.office = best.idx;

    // 2. social and status messages never need a meeting
    if (base === 'greeting' || base === 'thanks' || (base === 'chat' && !work)) { out.intent = base === 'chat' ? 'chat' : base; out.why = 'No work was requested.'; step('Decision', 'Nothing to build: answer, no meeting.'); return out; }
    var STATUS_Q = /\b(status|progress|any (news|update)|where are we|how('?s| is| are) (it|the (project|plan|task|work|team|offices)|things|we|everyone)( going| doing)?|what('?s| is) (happening|going on)|are (you|we) done|done yet|finished yet)\b/i;
    if (base === 'status' || (STATUS_Q.test(raw) && !work)) { out.intent = 'status'; out.why = 'You asked for progress.'; step('Decision', 'Report the current status, no meeting.'); return out; }

    // 3. opinions and questions: answer, unless it is really a polite request for work
    if ((OPINION.test(raw) || (ANSWER_ASK.test(raw) || /\?\s*$/.test(raw))) && !polite) {
      out.intent = OPINION.test(raw) ? 'opinion' : 'question'; out.why = OPINION.test(raw) ? 'You asked what I think.' : 'You asked a question.';
      step('Decision', 'A question or opinion: I answer it myself, no meeting.'); return out;
    }

    // 4. work requests
    if (work || polite || base === 'task') {
      var vague = /\b(it|this|that|these|those|them)\b/.test(t) && n <= 5 && best.n < 2;
      var strong = (best.n >= 1 || n >= 5) && !vague;
      if (!strong) { out.kind = 'clarify'; out.intent = 'task'; out.why = 'The request is too short to know which offices it needs.'; step('Decision', 'Too vague for a meeting: ask one question first.'); out.reply = 'I can start that, but I need a little more. What should be built or changed, and who is it for? One line is enough and I will call the right heads.'; return out; }
      out.kind = 'meeting'; out.intent = 'task';
      out.why = best.n ? 'It is a request for work that touches ' + brain.offices[best.idx].name + '.' : 'It is a request for work.';
      step('Decision', 'Work request: call only the offices that matter' + (best.n ? ', starting with ' + brain.offices[best.idx].name + ' (' + head(best.idx) + ')' : '') + '.'); return out;
    }

    // 5. anything else with 3+ words and no work verb: treat as conversation, but offer the meeting
    out.intent = 'chat'; out.why = 'It reads as conversation, not a request for work.'; step('Decision', 'Answer, and offer a meeting if it was meant as a task.'); out.offer = true; return out;
  }

  // The CEO's own answer for messages that do not need a meeting. Uses real company state, never invents results.
  function ceoAnswer(brain, ctx, text, decision, rand) {
    rand = rand || Math.random; ctx = ctx || {}; var d = decision || ceoDecide(brain, ctx, text), people = ctx.people || [], P = ctx.project, raw = String(text || '').replace(/^\/(ask|answer)\s*/i, '');
    if (d.reply) return d.reply;
    var busy = (ctx.working || 0) + ' of ' + ((ctx.working || 0) + (ctx.idle || 0)) + ' people are working right now';
    if (d.intent === 'greeting') return pick(['Hello. ', 'Hi. ', 'Good to hear from you. '], rand) + (P ? 'We are on "' + short(P.task, 40) + '" (' + phaseLabel(P) + ').' : 'Nothing is in progress, ' + busy + '.') + ' Give me a task and I will call the right heads.';
    if (d.intent === 'thanks') return pick(['You are welcome.', 'Glad it helps.', 'Of course.'], rand) + (P ? ' I will keep the project moving.' : ' Tell me when you have the next task.');
    if (d.intent === 'status') {
      if (!P) return 'No project is running. ' + busy + (ctx.queued ? ', and ' + ctx.queued + ' task' + (ctx.queued > 1 ? 's are' : ' is') + ' queued' : '') + '. Give me a task and I will start one.';
      return 'Project "' + short(P.task, 50) + '": ' + phaseLabel(P) + '.' + (P.heads ? ' ' + (P.done || 0) + ' of ' + P.heads + ' office heads have sent their proposal.' : '') + (P.phase === 'approval' && P.approval !== 'approved' ? ' It is waiting for your approval: reply yes, no, or tell me what to change.' : '') + (ctx.queued ? ' ' + ctx.queued + ' more queued.' : '');
    }
    var o = bestOffice(brain, norm(raw), -1);
    if (d.intent === 'opinion') {
      var who = o.n ? brain.offices[o.idx].name + ' (' + (headOf(people, o.idx) || { name: 'its head' }).name + ')' : null;
      return 'My view, in short: decide the smallest version that proves it works, then grow it. ' + (who ? 'The people who know this best are ' + who + '. ' : '') + 'If you want the offices to weigh in properly, say "call a meeting about this" and I will gather the right heads.';
    }
    if (d.intent === 'question') {
      if (/\b(who is|who's|what does|what role|which office|where does|tell me about)\b/i.test(raw)) {
        var matchingPeople = people.filter(function (p) { return norm(raw).indexOf(norm(p.name)) >= 0; });
        if (matchingPeople.length) return matchingPeople.map(function (p) {
          return p.name + ' is ' + p.role + ' in ' + p.office + (p.isHead ? ' and leads that office.' : '.');
        }).join(' ');
      }
      if (/\b(list|show|name|who are|who works|employees|agents|staff|directory)\b/i.test(raw) &&
          /\b(people|agents|employees|staff|team|directory|everyone|names)\b/i.test(raw) &&
          !/\bhow many\b/i.test(raw)) {
        return 'Here is the staff directory:\n' + people.map(function (p) {
          return p.name + ' — ' + p.role + ', ' + p.office + (p.company === 'Social Media Co.' ? ' (Social Media Co.)' : '');
        }).join('\n');
      }
      if (/\b(who|which office|which team|who handles|who is responsible)\b/i.test(raw) && o.n) return brain.offices[o.idx].name + ' handles that. ' + (headOf(people, o.idx) || { name: 'The head' }).name + ' leads it. ' + brain.offices[o.idx].mission + ' Want me to start it as a project?';
      if (/\b(how many|offices|people|agents|employees|staff|team|who works)\b/i.test(raw)) {
        var socialCount = people.filter(function (p) { return p.company === 'Social Media Co.'; }).length;
        var companyCount = people.length - socialCount;
        return 'I know the staff directory: ' + companyCount + ' people in Company Floor' +
          (socialCount ? ' and ' + socialCount + ' in Social Media Co. (' + people.length + ' total)' : '') +
          ', across ' + brain.offices.length + ' offices. ' + busy + '.';
      }
      return (o.n ? 'That sits with ' + brain.offices[o.idx].name + '. ' : '') + 'I can answer the part I know, but I will not guess about work I have not seen. If you want it done or checked, tell me and I will call the heads.';
    }
    return pick(['Understood. ', 'Noted. ', 'Okay. '], rand) + (d.offer ? 'If that was a task, say what you want built and I will call the heads to a meeting.' : 'Tell me what you need.');
  }
  function phaseLabel(P) { return ({ gather: 'calling the office heads', meeting: 'in the meeting', approval: 'plan ready for you', running: 'the office simulation is running' })[P.phase] || P.phase; }

  var api = { ceoDecide: ceoDecide, ceoAnswer: ceoAnswer, relevantOffices: relevantOffices, propose: propose, consolidate: consolidate, reason: reason, classify: classify, hits: hits, bestOffice: bestOffice, bestPerson: bestPerson, findPeople: findPeople, parseSummonCommand: parseSummonCommand, norm: norm };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CompanyBrain = api;
})(typeof window !== 'undefined' ? window : this);
