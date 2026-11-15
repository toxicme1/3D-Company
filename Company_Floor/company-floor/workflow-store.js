'use strict';

const fs = require('node:fs');
const path = require('node:path');

class WorkflowStore {
  constructor(file) {
    this.file = path.resolve(file);
    this.states = new Map();
    let loaded = {};
    try {
      loaded = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error('Could not load workflow status: ' + error.message);
    }
    if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) {
      throw new Error('Workflow status file must contain an object.');
    }
    Object.entries(loaded).forEach(([id, state]) => {
      if (state && typeof state === 'object' && !Array.isArray(state)) this.states.set(id, state);
    });
    let recovered = false;
    for (const [id, state] of this.states) {
      if (!['completed', 'failed'].includes(state.status)) {
        this.states.set(id, Object.assign({}, state, {
          status: 'failed',
          stage: 'failed',
          activeAgent: '',
          approvalId: '',
          message: 'The API bridge restarted before this workflow finished. No pending action was applied; start a new workflow.',
          updatedAt: Date.now()
        }));
        recovered = true;
      }
    }
    if (recovered || !fs.existsSync(this.file)) this.persist();
  }

  update(id, conv, fields) {
    if (typeof id !== 'string' || !/^[\w.-]{1,80}$/.test(id)) throw new Error('Invalid workflow ID.');
    const state = Object.assign({}, this.states.get(id) || {}, fields, {
      id,
      conv,
      updatedAt: Date.now()
    });
    this.states.set(id, state);
    const latest = Array.from(this.states.entries()).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, 20);
    this.states = new Map(latest);
    this.persist();
    return state;
  }

  all() {
    return Array.from(this.states.values()).sort((a, b) => a.updatedAt - b.updatedAt);
  }

  persist() {
    const temp = this.file + '.' + process.pid + '.tmp';
    try {
      fs.writeFileSync(temp, JSON.stringify(Object.fromEntries(this.states), null, 1));
      fs.renameSync(temp, this.file);
    } catch (error) {
      try { fs.unlinkSync(temp); } catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') error.message += ' Temporary status cleanup failed: ' + cleanupError.message;
      }
      throw new Error('Could not persist workflow status: ' + error.message);
    }
  }
}

module.exports = { WorkflowStore };
