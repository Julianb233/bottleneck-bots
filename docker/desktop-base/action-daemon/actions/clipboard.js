'use strict';

const { execFile, exec } = require('node:child_process');

async function clipboard_read() {
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/xclip', ['-selection', 'clipboard', '-o'], {
      timeout: 5000,
      env: process.env,
    }, (err, stdout) => {
      if (err) {
        if (err.code === 1) {
          return resolve({ text: '' });
        }
        return reject(new Error(`clipboard_read failed: ${err.message}`));
      }
      resolve({ text: stdout });
    });
  });
}

async function clipboard_write(params) {
  const { text } = params;

  if (typeof text !== 'string') {
    throw new Error('clipboard_write: text must be a string');
  }

  if (text.length > 1024 * 1024) {
    throw new Error('clipboard_write: text exceeds 1MB limit');
  }

  return new Promise((resolve, reject) => {
    const proc = exec(
      'xclip -selection clipboard',
      { timeout: 5000, env: process.env },
      (err) => {
        if (err) return reject(new Error(`clipboard_write failed: ${err.message}`));
        resolve({ written: text.length });
      }
    );
    proc.stdin.write(text);
    proc.stdin.end();
  });
}

/**
 * Route a clipboard action to the correct handler.
 * @param {string} action - 'clipboard_read' or 'clipboard_write'
 * @param {object} params - Action parameters
 * @returns {Promise<object>}
 */
async function handleClipboard(action, params) {
  if (action === 'clipboard_read') return clipboard_read();
  if (action === 'clipboard_write') return clipboard_write(params);
  throw new Error(`Unknown clipboard action: ${action}`);
}

module.exports = { clipboard_read, clipboard_write, handleClipboard };
