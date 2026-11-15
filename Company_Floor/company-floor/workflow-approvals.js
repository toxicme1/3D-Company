'use strict';

class WorkflowApprovalQueue {
  constructor(options) {
    const config = options || {};
    this.timeoutMs = Number.isFinite(config.timeoutMs) && config.timeoutMs > 0
      ? config.timeoutMs
      : 10 * 60 * 1000;
    this.pending = new Map();
  }

  wait(id, value, onTimeout) {
    if (this.pending.has(id)) throw new Error('An approval with this ID is already pending.');
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        try {
          if (typeof onTimeout === 'function') onTimeout();
          resolve({ approved: false, reason: 'Approval expired; no action was performed.' });
        } catch (error) {
          reject(error);
        }
      }, this.timeoutMs);
      if (typeof timer.unref === 'function') timer.unref();
      this.pending.set(id, { resolve, reject, timer, value });
    });
  }

  get(id) {
    const pending = this.pending.get(id);
    return pending && pending.value;
  }

  resolve(id, result) {
    const pending = this.pending.get(id);
    if (!pending) return false;
    clearTimeout(pending.timer);
    this.pending.delete(id);
    pending.resolve(result);
    return true;
  }

  cancel(id, error) {
    const pending = this.pending.get(id);
    if (!pending) return false;
    clearTimeout(pending.timer);
    this.pending.delete(id);
    pending.reject(error);
    return true;
  }
}

module.exports = { WorkflowApprovalQueue };
