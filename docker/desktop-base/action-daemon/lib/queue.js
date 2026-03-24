'use strict';

const ACTION_TIMEOUT = 10_000; // 10s timeout per queued action

/**
 * Serial execution queue for xdotool commands.
 *
 * xdotool is NOT thread-safe — concurrent invocations cause race conditions
 * with X11 input state. This queue ensures only one xdotool command runs at
 * a time while allowing screenshot and bash actions to execute in parallel.
 *
 * Each queued action has a 10-second timeout. If an action exceeds this,
 * it is rejected and the queue moves to the next item.
 */
class ActionQueue {
  constructor() {
    /** @type {Array<{fn: Function, resolve: Function, reject: Function, enqueued: number}>} */
    this._queue = [];
    this._running = false;
  }

  /**
   * Enqueue a function that returns a Promise.
   * Returns a Promise that resolves/rejects with the function's result.
   * Each action is subject to a 10-second timeout.
   */
  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this._queue.push({ fn, resolve, reject, enqueued: Date.now() });
      this._drain();
    });
  }

  async _drain() {
    if (this._running) return;
    this._running = true;

    while (this._queue.length > 0) {
      const { fn, resolve, reject, enqueued } = this._queue.shift();

      // If this item has been waiting longer than the timeout, reject it
      const waitTime = Date.now() - enqueued;
      if (waitTime > ACTION_TIMEOUT) {
        reject(new Error(`Action timed out after ${waitTime}ms in queue`));
        continue;
      }

      try {
        // Race the action against a timeout
        const result = await Promise.race([
          fn(),
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error(`Action execution timed out after ${ACTION_TIMEOUT}ms`)), ACTION_TIMEOUT)
          ),
        ]);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    }

    this._running = false;
  }

  /** Number of actions waiting in the queue */
  get pending() {
    return this._queue.length;
  }

  /** Whether the queue is currently executing an action */
  get busy() {
    return this._running;
  }
}

module.exports = { ActionQueue };
