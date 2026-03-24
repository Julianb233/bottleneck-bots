import chalk from 'chalk';
import Table from 'cli-table3';
import ora, { type Ora } from 'ora';

let jsonMode = false;
let verboseMode = false;

export function setJsonMode(enabled: boolean): void {
  jsonMode = enabled;
}

export function setVerboseMode(enabled: boolean): void {
  verboseMode = enabled;
}

export function isJsonMode(): boolean {
  return jsonMode;
}

export function isVerboseMode(): boolean {
  return verboseMode;
}

// ---------------------------------------------------------------------------
// JSON output
// ---------------------------------------------------------------------------

export function outputJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Table output
// ---------------------------------------------------------------------------

export function outputTable(headers: string[], rows: string[][]): void {
  if (jsonMode) {
    // In JSON mode, convert to array of objects
    const objects = rows.map(row => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h.toLowerCase().replace(/\s+/g, '_')] = row[i] ?? '';
      });
      return obj;
    });
    outputJson(objects);
    return;
  }

  const table = new Table({
    head: headers.map(h => chalk.cyan.bold(h)),
    style: { head: [], border: [] },
    chars: {
      top: '', 'top-mid': '', 'top-left': '', 'top-right': '',
      bottom: '', 'bottom-mid': '', 'bottom-left': '', 'bottom-right': '',
      left: '', 'left-mid': '', mid: '', 'mid-mid': '',
      right: '', 'right-mid': '', middle: '  ',
    },
  });

  for (const row of rows) {
    table.push(row);
  }

  console.log(table.toString());
}

// ---------------------------------------------------------------------------
// Status messages
// ---------------------------------------------------------------------------

export function success(msg: string): void {
  if (!jsonMode) {
    console.log(chalk.green('  ') + msg);
  }
}

export function error(msg: string): void {
  if (!jsonMode) {
    console.error(chalk.red('Error: ') + msg);
  }
}

export function warn(msg: string): void {
  if (!jsonMode) {
    console.warn(chalk.yellow('Warning: ') + msg);
  }
}

export function info(msg: string): void {
  if (!jsonMode) {
    console.log(chalk.blue('  ') + msg);
  }
}

export function verbose(msg: string): void {
  if (verboseMode && !jsonMode) {
    console.log(chalk.gray('[verbose] ') + msg);
  }
}

// ---------------------------------------------------------------------------
// Spinners
// ---------------------------------------------------------------------------

export function spinner(text: string): Ora {
  if (jsonMode) {
    // Return a no-op spinner in JSON mode
    return ora({ text, isSilent: true });
  }
  return ora({ text, color: 'cyan' }).start();
}

// ---------------------------------------------------------------------------
// Key-value detail display
// ---------------------------------------------------------------------------

export function outputDetail(data: Record<string, unknown>): void {
  if (jsonMode) {
    outputJson(data);
    return;
  }

  const maxKeyLen = Math.max(...Object.keys(data).map(k => k.length));
  for (const [key, value] of Object.entries(data)) {
    const label = chalk.bold(key.padEnd(maxKeyLen));
    console.log(`  ${label}  ${value}`);
  }
}

// ---------------------------------------------------------------------------
// Status badges
// ---------------------------------------------------------------------------

export function statusBadge(status: string): string {
  const s = status.toLowerCase();
  if (s === 'running' || s === 'ready' || s === 'active' || s === 'healthy') {
    return chalk.green(status);
  }
  if (s === 'stopped' || s === 'destroyed' || s === 'failed' || s === 'unhealthy') {
    return chalk.red(status);
  }
  if (s === 'creating' || s === 'starting' || s === 'stopping' || s === 'building') {
    return chalk.yellow(status);
  }
  return chalk.gray(status);
}
