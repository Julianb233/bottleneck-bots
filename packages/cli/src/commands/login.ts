import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { setConfig, clearConfig, getApiKey, getApiUrl, getActiveWorkspace, getConfigPath } from '../lib/config.js';
import { api, handleApiError } from '../lib/api-client.js';
import { success, error, info, outputDetail, isJsonMode, outputJson } from '../lib/output.js';

interface UserInfo {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

interface WorkspaceItem {
  id: string;
  name: string;
}

interface WorkspacesResponse {
  workspaces: WorkspaceItem[];
}

export function registerLoginCommands(program: Command): void {
  // ── bnb login ──────────────────────────────────────────────────────────
  program
    .command('login')
    .description('Authenticate with the Bottleneck Bots API')
    .option('--api-key <key>', 'API key (sk_live_...)')
    .option('--api-url <url>', 'API server URL')
    .action(async (opts: { apiKey?: string; apiUrl?: string }) => {
      try {
        let apiUrl = opts.apiUrl;
        let apiKey = opts.apiKey;

        if (!apiKey) {
          // Interactive mode
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'apiUrl',
              message: 'API URL:',
              default: getApiUrl() || 'http://localhost:3000',
              when: !apiUrl,
            },
            {
              type: 'password',
              name: 'apiKey',
              message: 'API key (sk_live_...):',
              mask: '*',
              validate: (input: string) => {
                if (!input.trim()) return 'API key is required';
                return true;
              },
            },
          ]);

          apiUrl = apiUrl || answers.apiUrl;
          apiKey = answers.apiKey;
        }

        if (!apiUrl) {
          apiUrl = getApiUrl() || 'http://localhost:3000';
        }

        // Store temporarily to validate
        setConfig('apiUrl', apiUrl);
        setConfig('apiKey', apiKey!);

        // Validate by listing workspaces
        const data = await api<WorkspacesResponse>('/api/v1/workspaces');

        // Auto-select first workspace if none active
        if (data.workspaces && data.workspaces.length > 0 && !getActiveWorkspace()) {
          setConfig('activeWorkspace', data.workspaces[0].id);
          info(`Active workspace: ${data.workspaces[0].name} (${data.workspaces[0].id})`);
        }

        success(`Authenticated to ${apiUrl}`);
        info(`Config saved to ${getConfigPath()}`);
      } catch (err: unknown) {
        clearConfig();
        handleApiError(err);
      }
    });

  // ── bnb logout ─────────────────────────────────────────────────────────
  program
    .command('logout')
    .description('Remove stored credentials')
    .action(() => {
      clearConfig();
      success('Logged out. Credentials removed.');
    });

  // ── bnb whoami ─────────────────────────────────────────────────────────
  program
    .command('whoami')
    .description('Show current user and active workspace')
    .action(async () => {
      try {
        const apiKey = getApiKey();
        if (!apiKey) {
          error('Not authenticated. Run "bnb login" first.');
          process.exit(1);
        }

        const data = await api<WorkspacesResponse>('/api/v1/workspaces');
        const activeWs = getActiveWorkspace();
        const activeWorkspace = data.workspaces?.find((w: WorkspaceItem) => w.id === activeWs);

        if (isJsonMode()) {
          outputJson({
            api_url: getApiUrl(),
            api_key: apiKey.slice(0, 10) + '...' + apiKey.slice(-4),
            active_workspace: activeWorkspace || null,
            workspaces: data.workspaces?.length || 0,
          });
          return;
        }

        outputDetail({
          'API URL': getApiUrl(),
          'API Key': apiKey.slice(0, 10) + '...' + apiKey.slice(-4),
          'Active Workspace': activeWorkspace
            ? `${activeWorkspace.name} (${activeWorkspace.id})`
            : chalk.yellow('none'),
          'Workspaces': String(data.workspaces?.length || 0),
          'Config': getConfigPath(),
        });
      } catch (err: unknown) {
        handleApiError(err);
      }
    });
}
