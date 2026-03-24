import Docker from 'dockerode';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { computers } from '../db/schema.js';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const DEFAULT_TIMEOUT_MS = 60_000;

export interface ActionResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  duration_ms: number;
}

/**
 * Send an action to the action daemon inside a container via docker exec.
 *
 * Resolves the container_id from the database using the computer's UUID,
 * then communicates with the in-container daemon listening on
 * /tmp/orgo-action.sock.
 *
 * @param computerId - Computer UUID (looked up in the computers table)
 * @param action     - Action name (screenshot, click, type, etc.)
 * @param params     - Action-specific parameters
 * @param timeoutMs  - Timeout in milliseconds (default 60s)
 */
export async function sendAction(
  computerId: string,
  action: string,
  params: Record<string, unknown> = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<ActionResult> {
  const start = Date.now();

  // ── Resolve container_id from DB ──────────────────────────────────────────
  let containerId: string | null;
  try {
    const [computer] = await db
      .select({ containerId: computers.containerId, status: computers.status })
      .from(computers)
      .where(eq(computers.id, computerId));

    if (!computer) {
      return {
        success: false,
        error: 'Computer not found.',
        duration_ms: Date.now() - start,
      };
    }

    if (computer.status !== 'running') {
      return {
        success: false,
        error: `Computer is not running (current status: ${computer.status}).`,
        duration_ms: Date.now() - start,
      };
    }

    containerId = computer.containerId;
  } catch (err: any) {
    return {
      success: false,
      error: `Database error: ${err.message}`,
      duration_ms: Date.now() - start,
    };
  }

  if (!containerId) {
    return {
      success: false,
      error: 'No container ID associated with this computer.',
      duration_ms: Date.now() - start,
    };
  }

  // ── Execute via Dockerode ─────────────────────────────────────────────────
  const container = docker.getContainer(containerId);
  const message = JSON.stringify({ action, params });

  // Inner socket timeout is slightly less than the outer exec timeout
  // so the daemon can respond with its own timeout error before we kill exec.
  const socketTimeoutMs = Math.max(timeoutMs - 5000, 5000);

  // Use a node one-liner to send to the unix socket inside the container
  const cmd = [
    'node',
    '-e',
    `const net=require('net');` +
      `const c=net.connect('/tmp/orgo-action.sock');` +
      `c.write(${JSON.stringify(message)}+'\\n');` +
      `let d='';` +
      `c.on('data',b=>{d+=b;try{JSON.parse(d);process.stdout.write(d);c.end()}catch{}});` +
      `c.on('error',e=>{process.stdout.write(JSON.stringify({success:false,error:e.message}));c.end()});` +
      `setTimeout(()=>{process.stdout.write(JSON.stringify({success:false,error:'timeout'}));c.end()},${socketTimeoutMs});`,
  ];

  try {
    const exec = await container.exec({
      Cmd: cmd,
      AttachStdout: true,
      AttachStderr: true,
      Env: ['DISPLAY=:99'],
    });

    const stream = await exec.start({ hijack: true, stdin: false });
    const output = await collectStream(stream, timeoutMs);

    try {
      // Docker exec multiplexed streams include 8-byte binary headers per frame.
      // Strip all non-printable characters (except common whitespace) to get
      // clean JSON output, then extract the JSON object.
      const clean = output.replace(/[^\x20-\x7E\t\n\r]/g, '');
      const jsonStart = clean.indexOf('{');
      const jsonEnd = clean.lastIndexOf('}');
      if (jsonStart < 0 || jsonEnd <= jsonStart) {
        return {
          success: false,
          error: `No JSON in daemon response (raw=${output.length}b, clean=${clean.length}b)`,
          duration_ms: Date.now() - start,
        };
      }
      // The daemon may output multiple JSON objects (e.g. success + timeout).
      // Extract only the first complete JSON object by tracking brace depth.
      let depth = 0;
      let firstEnd = -1;
      let inString = false;
      let escape = false;
      for (let i = jsonStart; i <= jsonEnd; i++) {
        const ch = clean[i]!;
        if (escape) { escape = false; continue; }
        if (ch === '\\' && inString) { escape = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) { firstEnd = i; break; } }
      }
      if (firstEnd < 0) firstEnd = jsonEnd;
      const jsonStr = clean.slice(jsonStart, firstEnd + 1);
      let result: any;
      try {
        result = JSON.parse(jsonStr);
      } catch (parseErr: any) {
        const errPos = parseErr.message?.match(/position (\d+)/)?.[1];
        const pos = errPos ? parseInt(errPos, 10) : -1;
        const context = pos >= 0 ? jsonStr.slice(Math.max(0, pos - 20), pos + 20) : '';
        return {
          success: false,
          error: `JSON parse failed at pos ${pos} (len=${jsonStr.length}): ...${context}...`,
          duration_ms: Date.now() - start,
        };
      }
      return {
        success: result.success ?? false,
        data: result.data ?? result,
        error: result.error,
        duration_ms: Date.now() - start,
      };
    } catch (outerErr: any) {
      return {
        success: false,
        error: `Unexpected error: ${outerErr?.message ?? 'unknown'}`,
        duration_ms: Date.now() - start,
      };
    }
  } catch (err: any) {
    // Distinguish container-not-found from other errors
    if (err.statusCode === 404) {
      return {
        success: false,
        error: 'Container not found. It may have been removed.',
        duration_ms: Date.now() - start,
      };
    }

    // Daemon unresponsive (connection refused, socket hang up, etc.)
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
      return {
        success: false,
        error: 'Action daemon unresponsive inside the container.',
        duration_ms: Date.now() - start,
      };
    }

    return {
      success: false,
      error: err.message ?? 'Unknown error communicating with container',
      duration_ms: Date.now() - start,
    };
  }
}

/**
 * Collect output from a Docker exec multiplexed stream.
 *
 * Docker multiplexed streams have 8-byte headers per frame:
 *   [stream_type(1)][0(3)][size(4 big-endian)]
 * We need to properly demultiplex to avoid corrupted output on large payloads.
 */
function collectStream(
  stream: NodeJS.ReadableStream,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => {
      stream.removeAllListeners();
      const data = demuxBuffers(chunks);
      resolve(data || '{"success":false,"error":"exec timeout"}');
    }, timeoutMs);

    stream.on('data', (chunk: Buffer) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    stream.on('end', () => {
      clearTimeout(timer);
      resolve(demuxBuffers(chunks));
    });

    stream.on('error', () => {
      clearTimeout(timer);
      const data = demuxBuffers(chunks);
      resolve(data || '{"success":false,"error":"stream error"}');
    });
  });
}

/**
 * Demultiplex Docker exec stream buffers.
 * Each frame: [type(1)][pad(3)][size(4 big-endian)][payload(size)]
 */
function demuxBuffers(chunks: Buffer[]): string {
  const buf = Buffer.concat(chunks);
  const payloads: Buffer[] = [];
  let offset = 0;

  while (offset + 8 <= buf.length) {
    const size = buf.readUInt32BE(offset + 4);
    const payloadStart = offset + 8;
    const payloadEnd = payloadStart + size;

    if (payloadEnd > buf.length) {
      // Incomplete frame — grab what we can
      payloads.push(buf.slice(payloadStart));
      break;
    }

    payloads.push(buf.slice(payloadStart, payloadEnd));
    offset = payloadEnd;
  }

  // If we couldn't parse any frames, return raw (non-multiplexed output)
  if (payloads.length === 0 && buf.length > 0) {
    return buf.toString();
  }

  return Buffer.concat(payloads).toString();
}
