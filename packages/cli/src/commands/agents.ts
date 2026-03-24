import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { api, resolveWorkspace, handleApiError } from '../lib/api-client.js';
import {
  outputTable, success, error, info, spinner, statusBadge,
  isJsonMode, outputJson, outputDetail, verbose,
} from '../lib/output.js';

interface Agent {
  id: string;
  name: string;
  type: string;
  status: string;
  health?: string;
  createdAt?: string;
  config?: Record<string, string>;
}

interface AgentsResponse {
  agents: Agent[];
}

interface AgentResponse {
  agent: Agent;
}

interface LogsResponse {
  logs: string;
}

export function registerAgentCommands(program: Command): void {
  const cmd = new Command('agents')
    .description('Manage agents')
    .action(async function (this: Command) {
      await listAgents(this.optsWithGlobals().workspace);
    });

  cmd
    .command('list')
    .description('List all agents')
    .action(async function (this: Command) {
      await listAgents(this.optsWithGlobals().workspace);
    });

  cmd
    .command('deploy')
    .description('Deploy an agent')
    .argument('<type>', 'Agent type (e.g., openclaw, browser-agent)')
    .option('--config <pairs...>', 'Configuration key=value pairs')
    .option('--name <name>', 'Agent name')
    .action(async function (this: Command, type: string, opts: { config?: string[]; name?: string }) {
      try {
        const wsId = resolveWorkspace(this.optsWithGlobals().workspace);

        // Parse config from key=value pairs
        let config: Record<string, string> = {};
        if (opts.config) {
          for (const pair of opts.config) {
            const eqIdx = pair.indexOf('=');
            if (eqIdx === -1) {
              error(`Invalid config format: "${pair}". Use key=value.`);
              process.exit(1);
            }
            config[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1);
          }
        } else {
          // Interactive config prompts
          const { wantConfig } = await inquirer.prompt([{
            type: 'confirm',
            name: 'wantConfig',
            message: 'Add configuration keys?',
            default: false,
          }]);

          if (wantConfig) {
            let addMore = true;
            while (addMore) {
              const { key, value } = await inquirer.prompt([
                { type: 'input', name: 'key', message: 'Config key:' },
                { type: 'input', name: 'value', message: 'Config value:' },
              ]);
              if (key) config[key] = value;
              const resp = await inquirer.prompt([{
                type: 'confirm', name: 'more', message: 'Add another?', default: false,
              }]);
              addMore = resp.more;
            }
          }
        }

        const agentName = opts.name || `${type}-${Date.now().toString(36)}`;

        const spin = spinner(`Deploying agent "${agentName}" (${type})...`);
        const data = await api<AgentResponse>(`/api/v1/workspaces/${wsId}/agents`, {
          method: 'POST',
          body: {
            name: agentName,
            type,
            config,
          },
        });
        spin.succeed(`Agent deployed: ${data.agent.name} (${data.agent.id})`);

        if (!isJsonMode()) {
          outputDetail({
            'ID': data.agent.id,
            'Type': data.agent.type,
            'Status': statusBadge(data.agent.status),
          });
        } else {
          outputJson(data.agent);
        }
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  cmd
    .command('status')
    .description('Show agent details and health')
    .argument('<id>', 'Agent ID')
    .action(async (id: string) => {
      try {
        const spin = spinner('Fetching agent status...');
        const data = await api<AgentResponse>(`/api/v1/agents/${id}`);
        spin.stop();

        if (isJsonMode()) {
          outputJson(data.agent);
          return;
        }

        outputDetail({
          'ID': data.agent.id,
          'Name': data.agent.name,
          'Type': data.agent.type,
          'Status': statusBadge(data.agent.status),
          'Health': data.agent.health ? statusBadge(data.agent.health) : chalk.gray('unknown'),
          'Created': data.agent.createdAt ? new Date(data.agent.createdAt).toLocaleString() : '-',
        });
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  cmd
    .command('logs')
    .description('View agent logs')
    .argument('<id>', 'Agent ID')
    .option('-f, --follow', 'Follow log output')
    .option('--tail <lines>', 'Number of lines', '100')
    .action(async (id: string, opts: { follow?: boolean; tail: string }) => {
      try {
        if (opts.follow) {
          let lastLog = '';
          info(`Following logs for agent ${id}. Press Ctrl+C to stop.`);

          const poll = async () => {
            try {
              const data = await api<LogsResponse>(`/api/v1/agents/${id}/logs`, {
                query: { tail: opts.tail },
              });
              if (data.logs !== lastLog) {
                process.stdout.write(data.logs);
                lastLog = data.logs;
              }
            } catch {
              // Continue polling
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
          const data = await api<LogsResponse>(`/api/v1/agents/${id}/logs`, {
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

  cmd
    .command('stop')
    .description('Stop an agent')
    .argument('<id>', 'Agent ID')
    .action(async (id: string) => {
      try {
        const spin = spinner('Stopping agent...');
        await api(`/api/v1/agents/${id}/stop`, { method: 'POST' });
        spin.succeed(`Agent ${id} stopped.`);
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  cmd
    .command('restart')
    .description('Restart an agent')
    .argument('<id>', 'Agent ID')
    .action(async (id: string) => {
      try {
        const spin = spinner('Restarting agent...');
        await api(`/api/v1/agents/${id}/restart`, { method: 'POST' });
        spin.succeed(`Agent ${id} restarted.`);
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  cmd
    .command('destroy')
    .description('Stop and destroy an agent')
    .argument('<id>', 'Agent ID')
    .option('-f, --force', 'Skip confirmation')
    .action(async (id: string, opts: { force?: boolean }) => {
      try {
        if (!opts.force) {
          const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: `Destroy agent ${id}? This cannot be undone.`,
            default: false,
          }]);
          if (!confirm) {
            info('Cancelled.');
            return;
          }
        }

        const spin = spinner('Destroying agent...');
        await api(`/api/v1/agents/${id}`, { method: 'DELETE' });
        spin.succeed(`Agent ${id} destroyed.`);
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  program.addCommand(cmd);
}

async function listAgents(workspaceOverride?: string): Promise<void> {
  try {
    const wsId = resolveWorkspace(workspaceOverride);
    const spin = spinner('Fetching agents...');
    const data = await api<AgentsResponse>(`/api/v1/workspaces/${wsId}/agents`);
    spin.stop();

    if (isJsonMode()) {
      outputJson(data.agents);
      return;
    }

    if (!data.agents || data.agents.length === 0) {
      info('No agents found. Deploy one with "bnb agents deploy <type>".');
      return;
    }

    const rows = data.agents.map((a: Agent) => [
      a.name,
      a.id.slice(0, 8),
      a.type,
      statusBadge(a.status),
      a.health ? statusBadge(a.health) : chalk.gray('-'),
      a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '-',
    ]);

    outputTable(['Name', 'ID', 'Type', 'Status', 'Health', 'Created'], rows);
  } catch (err: unknown) {
    handleApiError(err);
  }
}
