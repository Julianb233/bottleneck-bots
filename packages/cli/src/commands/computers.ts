import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { api, resolveWorkspace, handleApiError } from '../lib/api-client.js';
import { getApiUrl, getApiKey } from '../lib/config.js';
import {
  outputTable, success, error, info, spinner, statusBadge,
  isJsonMode, outputJson, outputDetail, verbose,
} from '../lib/output.js';

interface Computer {
  id: string;
  name: string;
  status: string;
  template?: string;
  cpu?: number;
  ramMb?: number;
  resolution?: string;
  containerId?: string;
  createdAt?: string;
}

interface ComputersResponse {
  computers: Computer[];
}

interface ComputerResponse {
  computer: Computer;
}

interface LogsResponse {
  logs: string;
}

function createComputersCommand(): Command {
  const cmd = new Command('computers')
    .description('Manage computers (virtual machines)')
    .action(async function (this: Command) {
      await listComputers(this.optsWithGlobals().workspace);
    });

  cmd
    .command('list')
    .description('List all computers in the active workspace')
    .action(async function (this: Command) {
      await listComputers(this.optsWithGlobals().workspace);
    });

  cmd
    .command('create')
    .description('Create a new computer')
    .argument('[name]', 'Computer name')
    .option('--template <template>', 'Template name')
    .option('--cpu <cores>', 'CPU cores', '2')
    .option('--ram <mb>', 'RAM in MB', '4096')
    .option('--resolution <res>', 'Screen resolution', '1280x720x24')
    .action(async function (this: Command, name?: string, opts?: {
      template?: string; cpu: string; ram: string; resolution: string;
    }) {
      try {
        const wsId = resolveWorkspace(this.optsWithGlobals().workspace);

        let computerName = name;
        let template = opts?.template;
        let cpu = parseInt(opts?.cpu || '2', 10);
        let ram = parseInt(opts?.ram || '4096', 10);

        // Interactive mode if no name given
        if (!computerName) {
          const answers = await inquirer.prompt([
            { type: 'input', name: 'name', message: 'Computer name:', default: 'my-computer' },
            { type: 'input', name: 'template', message: 'Template:', default: template || 'default', when: !template },
            { type: 'number', name: 'cpu', message: 'CPU cores:', default: cpu },
            { type: 'number', name: 'ram', message: 'RAM (MB):', default: ram },
          ]);
          computerName = answers.name;
          template = template || answers.template;
          cpu = answers.cpu ?? cpu;
          ram = answers.ram ?? ram;
        }

        const spin = spinner(`Creating computer "${computerName}"...`);
        const data = await api<ComputerResponse>(`/api/v1/workspaces/${wsId}/computers`, {
          method: 'POST',
          body: {
            name: computerName,
            template: template || 'default',
            cpu,
            ram,
            resolution: opts?.resolution || '1280x720x24',
          },
        });
        spin.succeed(`Computer created: ${data.computer.name} (${data.computer.id})`);

        if (!isJsonMode()) {
          outputDetail({
            'ID': data.computer.id,
            'Status': statusBadge(data.computer.status),
            'CPU': `${cpu} cores`,
            'RAM': `${ram} MB`,
          });
        } else {
          outputJson(data.computer);
        }
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  cmd
    .command('start')
    .description('Start a stopped computer')
    .argument('<id>', 'Computer ID')
    .action(async (id: string) => {
      try {
        const spin = spinner('Starting computer...');
        await api(`/api/v1/computers/${id}/start`, { method: 'POST' });
        spin.succeed(`Computer ${id} is starting.`);
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  cmd
    .command('stop')
    .description('Stop a running computer')
    .argument('<id>', 'Computer ID')
    .action(async (id: string) => {
      try {
        const spin = spinner('Stopping computer...');
        await api(`/api/v1/computers/${id}/stop`, { method: 'POST' });
        spin.succeed(`Computer ${id} is stopping.`);
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  cmd
    .command('destroy')
    .description('Destroy a computer permanently')
    .argument('<id>', 'Computer ID')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (id: string, opts: { force?: boolean }) => {
      try {
        if (!opts.force) {
          const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: `Destroy computer ${id}? This cannot be undone.`,
            default: false,
          }]);
          if (!confirm) {
            info('Cancelled.');
            return;
          }
        }

        const spin = spinner('Destroying computer...');
        await api(`/api/v1/computers/${id}/destroy`, { method: 'POST' });
        spin.succeed(`Computer ${id} destroyed.`);
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  cmd
    .command('ssh')
    .description('Open an interactive terminal session')
    .argument('<id>', 'Computer ID')
    .action(async (id: string) => {
      try {
        const apiUrl = getApiUrl();
        const apiKey = getApiKey();
        const wsUrl = apiUrl.replace(/^http/, 'ws');
        const termUrl = `${wsUrl}/ws/computers/${id}/terminal?token=${encodeURIComponent(apiKey)}`;

        verbose(`Connecting to ${termUrl}`);

        const { default: WebSocket } = await import('ws');
        const ws = new WebSocket(termUrl);

        ws.on('open', () => {
          info(`Connected to computer ${id}. Press Ctrl+] to disconnect.`);
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
          }
          process.stdin.resume();
        });

        ws.on('message', (data: Buffer) => {
          process.stdout.write(data);
        });

        process.stdin.on('data', (data: Buffer) => {
          // Ctrl+] (0x1d) to exit
          if (data.length === 1 && data[0] === 0x1d) {
            info('\nDisconnected.');
            ws.close();
            process.exit(0);
          }
          ws.send(data);
        });

        ws.on('close', () => {
          info('Connection closed.');
          process.exit(0);
        });

        ws.on('error', (err: Error) => {
          error(`WebSocket error: ${err.message}`);
          process.exit(1);
        });

        // Handle terminal resize
        process.stdout.on('resize', () => {
          const { columns, rows } = process.stdout;
          ws.send(JSON.stringify({ type: 'resize', cols: columns, rows }));
        });
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  cmd
    .command('screenshot')
    .description('Take a screenshot of a computer')
    .argument('<id>', 'Computer ID')
    .option('-o, --output <file>', 'Save to file (PNG)')
    .action(async (id: string, opts: { output?: string }) => {
      try {
        const spin = spinner('Taking screenshot...');
        const data = await api<{ screenshot: string }>(`/api/v1/computers/${id}/screenshot`, {
          method: 'POST',
        });
        spin.stop();

        if (opts.output) {
          const fs = await import('node:fs');
          const buffer = Buffer.from(data.screenshot, 'base64');
          fs.writeFileSync(opts.output, buffer);
          success(`Screenshot saved to ${opts.output}`);
        } else if (isJsonMode()) {
          outputJson({ screenshot: data.screenshot.slice(0, 100) + '...', size: data.screenshot.length });
        } else {
          info(`Screenshot captured (${Math.round(data.screenshot.length * 0.75 / 1024)} KB base64).`);
          info(`Use --output <file.png> to save to disk.`);
        }
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  cmd
    .command('vnc')
    .description('Open noVNC in default browser')
    .argument('<id>', 'Computer ID')
    .action(async (id: string) => {
      try {
        const apiUrl = getApiUrl();
        const vncUrl = `${apiUrl}/vnc/${id}`;
        info(`Opening noVNC for computer ${id}...`);

        const open = (await import('open')).default;
        await open(vncUrl);
        success(`Opened ${vncUrl} in your browser.`);
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  cmd
    .command('logs')
    .description('View computer logs')
    .argument('<id>', 'Computer ID')
    .option('-f, --follow', 'Follow log output')
    .option('--tail <lines>', 'Number of lines to show', '100')
    .action(async (id: string, opts: { follow?: boolean; tail: string }) => {
      try {
        if (opts.follow) {
          // Polling follow mode
          let lastLog = '';
          info(`Following logs for computer ${id}. Press Ctrl+C to stop.`);

          const poll = async () => {
            try {
              const data = await api<LogsResponse>(`/api/v1/computers/${id}/logs`, {
                query: { tail: opts.tail },
              });
              if (data.logs !== lastLog) {
                process.stdout.write(data.logs);
                lastLog = data.logs;
              }
            } catch {
              // Silently continue polling
            }
          };

          await poll();
          const interval = setInterval(poll, 2000);
          process.on('SIGINT', () => {
            clearInterval(interval);
            process.exit(0);
          });
        } else {
          const spin = spinner('Fetching logs...');
          const data = await api<LogsResponse>(`/api/v1/computers/${id}/logs`, {
            query: { tail: opts.tail },
          });
          spin.stop();

          if (isJsonMode()) {
            outputJson(data);
          } else {
            console.log(data.logs || chalk.gray('(no logs)'));
          }
        }
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  return cmd;
}

async function listComputers(workspaceOverride?: string): Promise<void> {
  try {
    const wsId = resolveWorkspace(workspaceOverride);
    const spin = spinner('Fetching computers...');
    const data = await api<ComputersResponse>(`/api/v1/workspaces/${wsId}/computers`);
    spin.stop();

    if (isJsonMode()) {
      outputJson(data.computers);
      return;
    }

    if (!data.computers || data.computers.length === 0) {
      info('No computers found. Create one with "bnb computers create".');
      return;
    }

    const rows = data.computers.map((c: Computer) => [
      c.name,
      c.id.slice(0, 8),
      statusBadge(c.status),
      c.template || '-',
      c.cpu ? `${c.cpu}` : '-',
      c.ramMb ? `${c.ramMb}MB` : '-',
      c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '-',
    ]);

    outputTable(['Name', 'ID', 'Status', 'Template', 'CPU', 'RAM', 'Created'], rows);
  } catch (err: unknown) {
    handleApiError(err);
  }
}

export function registerComputerCommands(program: Command): void {
  const vmCmd = createComputersCommand();
  program.addCommand(vmCmd);

  // Alias: vm
  const alias = createComputersCommand();
  alias.name('vm').description('Manage computers (alias for "computers")');
  program.addCommand(alias);
}
