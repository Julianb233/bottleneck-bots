'use strict';

const { execFile } = require('node:child_process');
const crypto = require('node:crypto');

/**
 * Screenshot capture using maim (with scrot fallback).
 * Returns base64-encoded image data.
 * Target: capture + encode < 50ms at 1280x720.
 *
 * Includes hash-based caching to skip re-encoding when the screen
 * hasn't changed (common during agent polling loops).
 */

// ── Screenshot cache ─────────────────────────────────────────────────────────

let _cache = {
  hash: null,
  image: null,
  format: null,
  width: 0,
  height: 0,
  bytes: 0,
};

function bufferHash(buf) {
  return crypto.createHash('md5').update(buf).digest('hex');
}

// ── capture helpers ──────────────────────────────────────────────────────────

function captureScreenshot(format = 'png') {
  return new Promise((resolve, reject) => {
    const args = ['--format', format === 'jpeg' ? 'jpg' : 'png', '/dev/stdout'];

    execFile('/usr/bin/maim', args, {
      encoding: 'buffer',
      timeout: 5000,
      maxBuffer: 10 * 1024 * 1024,
      env: process.env,
    }, (err, stdout) => {
      if (err) {
        return captureWithScrot().then(resolve).catch(reject);
      }
      resolve(stdout);
    });
  });
}

function captureWithScrot() {
  return new Promise((resolve, reject) => {
    const fs = require('node:fs');
    const tmpFile = `/tmp/orgo-screenshot-${Date.now()}.png`;
    execFile('/usr/bin/scrot', [tmpFile], {
      timeout: 5000,
      env: process.env,
    }, (err) => {
      if (err) return reject(new Error(`Screenshot failed: ${err.message}`));
      try {
        const data = fs.readFileSync(tmpFile);
        fs.unlinkSync(tmpFile);
        resolve(data);
      } catch (readErr) {
        reject(new Error(`Failed to read screenshot: ${readErr.message}`));
      }
    });
  });
}

function convertToJpeg(pngBuf, quality) {
  return new Promise((resolve, reject) => {
    const proc = execFile(
      '/usr/bin/convert',
      ['png:-', '-quality', String(quality), 'jpeg:-'],
      { encoding: 'buffer', maxBuffer: 20 * 1024 * 1024, timeout: 10000 },
      (err, stdout) => {
        if (err) return reject(err);
        resolve(stdout);
      }
    );
    proc.stdin.write(pngBuf);
    proc.stdin.end();
  });
}

function getResolution() {
  const res = process.env.RESOLUTION || '1280x720x24';
  const parts = res.split('x');
  return { width: parseInt(parts[0]) || 1280, height: parseInt(parts[1]) || 720 };
}

// ── main action ──────────────────────────────────────────────────────────────

async function screenshot(params = {}) {
  const format = (params.format || 'png').toLowerCase();
  if (format !== 'png' && format !== 'jpeg') {
    throw new Error(`screenshot: unsupported format "${format}" (use png or jpeg)`);
  }
  const quality = Math.min(Math.max(Math.round(params.quality ?? 80), 1), 100);

  // Capture raw PNG first (always PNG for caching consistency)
  const pngBuf = await captureScreenshot('png');
  const { width, height } = getResolution();

  // Check cache — if the raw PNG hasn't changed, return cached result
  const hash = bufferHash(pngBuf);
  if (_cache.hash === hash && _cache.format === format) {
    return {
      image: _cache.image,
      format: _cache.format,
      width: _cache.width,
      height: _cache.height,
      bytes: _cache.bytes,
      cached: true,
    };
  }

  // Convert format if needed
  let outputBuf = pngBuf;
  let outputFormat = 'png';

  if (format === 'jpeg') {
    try {
      outputBuf = await convertToJpeg(pngBuf, quality);
      outputFormat = 'jpeg';
    } catch {
      // convert not available — fall back to PNG
      outputBuf = pngBuf;
      outputFormat = 'png';
    }
  }

  const image = outputBuf.toString('base64');

  // Update cache
  _cache = { hash, image, format: outputFormat, width, height, bytes: outputBuf.length };

  return {
    image,
    format: outputFormat,
    width,
    height,
    bytes: outputBuf.length,
    cached: false,
  };
}

/**
 * Handler wrapper matching the dispatch pattern used by index.js.
 * @param {object} params - { format?, quality? }
 * @returns {Promise<object>}
 */
async function handleScreenshot(params = {}) {
  return screenshot(params);
}

module.exports = { screenshot, handleScreenshot };
