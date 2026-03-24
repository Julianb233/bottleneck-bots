'use strict';

const { exec: nodeExec } = require('node:child_process');
const fs = require('node:fs');

const MAX_OUTPUT = 1024 * 1024; // 1MB output cap
const DEFAULT_TIMEOUT = 30000;  // 30 seconds
const MAX_TIMEOUT = 300000;     // 5 minutes

function truncate(str, max) {
  if (!str || str.length <= max) return str;
  const suffix = `\n…[truncated at ${max} bytes]`;
  return str.slice(0, max - suffix.length) + suffix;
}

// ── dangerous command patterns ───────────────────────────────────────────────
// Block commands that could break the container or compromise the host.

const BLOCKED_PATTERNS = [
  { pattern: /rm\s+(-[a-zA-Z]*)?r[a-zA-Z]*f\s+\//, msg: 'destructive rm on root filesystem' },
  { pattern: /\bmkfs\b/, msg: 'filesystem format' },
  { pattern: /\bdd\b.*\bof=\/dev\/[sh]d/, msg: 'dd to block device' },
  { pattern: /:(){ :\|:& };:/, msg: 'fork bomb' },
  { pattern: /\bshutdown\b/, msg: 'shutdown' },
  { pattern: /\breboot\b/, msg: 'reboot' },
  { pattern: /\binit\s+[0-6]\b/, msg: 'init runlevel change' },
  { pattern: /\bsystemctl\s+(halt|poweroff|reboot)\b/, msg: 'systemctl power action' },
];

function validateCommand(command) {
  for (const { pattern, msg } of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      throw new Error(`Command blocked by safety filter: ${msg}`);
    }
  }
}

async function bash(params) {
  const { command, timeout = DEFAULT_TIMEOUT } = params;

  if (typeof command !== 'string' || command.length === 0) {
    throw new Error('bash: command must be a non-empty string');
  }

  validateCommand(command);

  const timeoutMs = Math.min(Math.max(Number(timeout) || DEFAULT_TIMEOUT, 1000), MAX_TIMEOUT);

  return new Promise((resolve) => {
    nodeExec(command, {
      timeout: timeoutMs,
      maxBuffer: MAX_OUTPUT + 4096, // small headroom
      env: process.env,
      shell: '/bin/bash',
    }, (err, stdout, stderr) => {
      if (err && err.killed) {
        return resolve({
          stdout: truncate(stdout || '', MAX_OUTPUT),
          stderr: truncate(stderr || '', MAX_OUTPUT),
          exit_code: 124,
          timed_out: true,
        });
      }

      resolve({
        stdout: truncate(stdout || '', MAX_OUTPUT),
        stderr: truncate(stderr || '', MAX_OUTPUT),
        exit_code: err ? (err.code || 1) : 0,
        timed_out: false,
      });
    });
  });
}

async function exec(params) {
  const { code, language = 'bash', timeout = DEFAULT_TIMEOUT } = params;

  if (typeof code !== 'string' || code.length === 0) {
    throw new Error('exec: code must be a non-empty string');
  }

  if (code.length > 100000) {
    throw new Error('exec: code exceeds 100KB limit');
  }

  const timeoutMs = Math.min(Math.max(Number(timeout) || DEFAULT_TIMEOUT, 1000), MAX_TIMEOUT);

  switch (language) {
    case 'python':
    case 'python3': {
      const tmpFile = `/tmp/orgo-exec-${Date.now()}-${Math.random().toString(36).slice(2)}.py`;
      fs.writeFileSync(tmpFile, code);
      try {
        return await bash({ command: `python3 "${tmpFile}"`, timeout: timeoutMs });
      } finally {
        try { fs.unlinkSync(tmpFile); } catch {}
      }
    }

    case 'node':
    case 'javascript': {
      const tmpFile = `/tmp/orgo-exec-${Date.now()}-${Math.random().toString(36).slice(2)}.js`;
      fs.writeFileSync(tmpFile, code);
      try {
        return await bash({ command: `node "${tmpFile}"`, timeout: timeoutMs });
      } finally {
        try { fs.unlinkSync(tmpFile); } catch {}
      }
    }

    case 'bash':
    case 'shell':
      return bash({ command: code, timeout: timeoutMs });

    default:
      throw new Error(`exec: unsupported language "${language}". Supported: python3, node, bash`);
  }
}

/**
 * Route an exec action to the correct handler.
 * @param {string} action - 'bash' or 'exec'
 * @param {object} params - Action parameters
 * @returns {Promise<object>}
 */
async function handleExec(action, params) {
  if (action === 'bash') return bash(params);
  if (action === 'exec') return exec(params);
  throw new Error(`Unknown exec action: ${action}`);
}

module.exports = { bash, exec, handleExec };
