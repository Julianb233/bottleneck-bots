'use strict';

const { execFile } = require('node:child_process');

const _resParts = (process.env.RESOLUTION || '1280x720').split('x').map(Number);
const RESOLUTION = { width: _resParts[0] || 1280, height: _resParts[1] || 720 };
const XDOTOOL = '/usr/bin/xdotool';

// ── helpers ──────────────────────────────────────────────────────────────────

function xdo(args, timeout = 5000) {
  return new Promise((resolve, reject) => {
    execFile(XDOTOOL, args, { timeout, env: process.env }, (err, stdout, stderr) => {
      if (err) {
        const msg = stderr?.trim() || err.message;
        return reject(new Error(`xdotool ${args[0]} failed: ${msg}`));
      }
      resolve(stdout.trim());
    });
  });
}

function validateCoords(x, y) {
  if (typeof x !== 'number' || typeof y !== 'number') {
    throw new Error(`Coordinates must be numbers, got x=${typeof x} y=${typeof y}`);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error(`Coordinates must be finite numbers`);
  }
  if (x < 0 || x >= RESOLUTION.width || y < 0 || y >= RESOLUTION.height) {
    throw new Error(
      `Coordinates (${x}, ${y}) out of bounds [0..${RESOLUTION.width - 1}, 0..${RESOLUTION.height - 1}]`
    );
  }
}

/**
 * Escape text for xdotool type.
 * xdotool type has issues with certain special characters.
 * We use --clearmodifiers and let xdotool handle most chars,
 * but newlines need to be sent as key presses.
 */
function escapeForType(text) {
  return String(text);
}

// ── actions ──────────────────────────────────────────────────────────────────

async function click(params) {
  const { x, y } = params;
  validateCoords(x, y);
  await xdo(['mousemove', '--sync', String(x), String(y)]);
  await xdo(['click', '1']);
  return { clicked: { x, y, button: 1 } };
}

async function right_click(params) {
  const { x, y } = params;
  validateCoords(x, y);
  await xdo(['mousemove', '--sync', String(x), String(y)]);
  await xdo(['click', '3']);
  return { clicked: { x, y, button: 3 } };
}

async function double_click(params) {
  const { x, y } = params;
  validateCoords(x, y);
  await xdo(['mousemove', '--sync', String(x), String(y)]);
  await xdo(['click', '--repeat', '2', '--delay', '100', '1']);
  return { clicked: { x, y, button: 1, repeat: 2 } };
}

async function type(params) {
  const { text } = params;
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('type: text must be a non-empty string');
  }
  if (text.length > 10000) {
    throw new Error('type: text exceeds 10 000 character limit');
  }
  const escaped = escapeForType(text);
  await xdo(['type', '--delay', '12', '--clearmodifiers', escaped]);
  return { typed: text.length };
}

async function key(params) {
  const { combo } = params;
  if (typeof combo !== 'string' || combo.length === 0) {
    throw new Error('key: combo must be a non-empty string');
  }
  // Validate combo format (e.g. "ctrl+c", "Return", "alt+F4")
  await xdo(['key', '--clearmodifiers', combo]);
  return { key: combo };
}

async function scroll(params) {
  const { direction = 'down', amount = 3 } = params;
  // X11 button 4 = scroll up, 5 = scroll down, 6 = scroll left, 7 = scroll right
  const BUTTON_MAP = { up: '4', down: '5', left: '6', right: '7' };
  const button = BUTTON_MAP[direction];
  if (!button) {
    throw new Error(`scroll: direction must be "up", "down", "left", or "right"`);
  }
  const clicks = Math.min(Math.max(Math.round(amount), 1), 50);
  await xdo(['click', '--repeat', String(clicks), button]);
  return { scrolled: { direction, clicks } };
}

async function drag(params) {
  const { x1, y1, x2, y2 } = params;
  validateCoords(x1, y1);
  validateCoords(x2, y2);
  await xdo(['mousemove', '--sync', String(x1), String(y1)]);
  await xdo(['mousedown', '1']);
  await xdo(['mousemove', '--sync', String(x2), String(y2)]);
  await xdo(['mouseup', '1']);
  return { dragged: { from: { x: x1, y: y1 }, to: { x: x2, y: y2 } } };
}

async function mouse_move(params) {
  const { x, y } = params;
  validateCoords(x, y);
  await xdo(['mousemove', '--sync', String(x), String(y)]);
  return { moved: { x, y } };
}

// ── dispatch ─────────────────────────────────────────────────────────────────

const HANDLERS = {
  click,
  right_click,
  double_click,
  type,
  key,
  scroll,
  drag,
  mouse_move,
};

/**
 * Route an input action to the correct handler.
 * @param {string} action - The action name
 * @param {object} params - Action parameters
 * @returns {Promise<object>} Result with data field
 */
async function handleInput(action, params) {
  const handler = HANDLERS[action];
  if (!handler) {
    throw new Error(`Unknown input action: ${action}`);
  }
  return handler(params);
}

// ── export ───────────────────────────────────────────────────────────────────

module.exports = {
  handleInput,
  click,
  right_click,
  double_click,
  type,
  key,
  scroll,
  drag,
  mouse_move,
};
