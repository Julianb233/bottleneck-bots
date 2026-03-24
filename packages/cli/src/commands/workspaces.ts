import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { setConfig, getActiveWorkspace } from '../lib/config.js';
import { api, handleApiError } from '../lib/api-client.js';
import { outputTable, success, error, info, spinner, isJsonMode, outputJson, outputDetail } from '../lib/output.js';

interface Workspace {
  id: string;
  name: string;
  createdAt?: string;
  updatedAt?: string;
}

interface WorkspacesResponse {
  workspaces: Workspace[];
}

interface WorkspaceResponse {
  workspace: Workspace;
}

function createWorkspacesCommand(): Command {
  const cmd = new Command('workspaces')
    .description('Manage workspaces')
    .action(async () => {
      // Default action: list workspaces
      await listWorkspaces();
    });

  cmd
    .command('list')
    .description('List all workspaces')
    .action(listWorkspaces);

  cmd
    .command('create')
    .description('Create a new workspace')
    .argument('<name>', 'Workspace name')
    .action(async (name: string) => {
      try {
        const spin = spinner(`Creating workspace "${name}"...`);
        const data = await api<WorkspaceResponse>('/api/v1/workspaces', {
          method: 'POST',
          body: { name },
        });
        spin.succeed(`Workspace created: ${data.workspace.name} (${data.workspace.id})`);
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  cmd
    .command('delete')
    .description('Delete a workspace')
    .argument('<id>', 'Workspace ID')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (id: string, opts: { force?: boolean }) => {
      try {
        if (!opts.force) {
          const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: `Delete workspace ${id}? This cannot be undone.`,
            default: false,
          }]);
          if (!confirm) {
            info('Cancelled.');
            return;
          }
        }

        const spin = spinner('Deleting workspace...');
        await api(`/api/v1/workspaces/${id}`, { method: 'DELETE' });
        spin.succeed('Workspace deleted.');

        // Clear active workspace if it was deleted
        if (getActiveWorkspace() === id) {
          setConfig('activeWorkspace', '');
          info('Active workspace cleared (deleted workspace was active).');
        }
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  cmd
    .command('use')
    .description('Set the active workspace')
    .argument('<id>', 'Workspace ID')
    .action(async (id: string) => {
      try {
        // Validate workspace exists
        const data = await api<WorkspacesResponse>('/api/v1/workspaces');
        const ws = data.workspaces.find((w: Workspace) => w.id === id);
        if (!ws) {
          error(`Workspace ${id} not found.`);
          process.exit(1);
        }
        setConfig('activeWorkspace', id);
        success(`Active workspace: ${ws.name} (${id})`);
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  cmd
    .command('members')
    .description('List members of the active workspace')
    .action(async () => {
      try {
        const wsId = getActiveWorkspace();
        if (!wsId) {
          error('No active workspace. Run "bnb workspaces use <id>" first.');
          process.exit(1);
        }

        // The API may not have a members endpoint yet — show workspace info
        const data = await api<WorkspacesResponse>('/api/v1/workspaces');
        const ws = data.workspaces.find((w: Workspace) => w.id === wsId);
        if (!ws) {
          error('Active workspace not found.');
          process.exit(1);
        }

        if (isJsonMode()) {
          outputJson({ workspace: ws, members: [] });
          return;
        }

        outputDetail({
          'Workspace': ws.name,
          'ID': ws.id,
          'Members': chalk.gray('(members API not yet available)'),
        });
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  cmd
    .command('invite')
    .description('Invite a member to the active workspace')
    .argument('<email>', 'Email address to invite')
    .option('--role <role>', 'Member role', 'member')
    .action(async (email: string, opts: { role: string }) => {
      try {
        const wsId = getActiveWorkspace();
        if (!wsId) {
          error('No active workspace. Run "bnb workspaces use <id>" first.');
          process.exit(1);
        }

        info(`Invite ${email} as ${opts.role} — workspace invitations not yet available in API.`);
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  return cmd;
}

async function listWorkspaces(): Promise<void> {
  try {
    const spin = spinner('Fetching workspaces...');
    const data = await api<WorkspacesResponse>('/api/v1/workspaces');
    spin.stop();

    const activeId = getActiveWorkspace();

    if (isJsonMode()) {
      outputJson(data.workspaces);
      return;
    }

    if (!data.workspaces || data.workspaces.length === 0) {
      info('No workspaces found. Create one with "bnb workspaces create <name>".');
      return;
    }

    const rows = data.workspaces.map((ws: Workspace) => [
      activeId === ws.id ? chalk.green('* ' + ws.name) : '  ' + ws.name,
      ws.id,
      ws.createdAt ? new Date(ws.createdAt).toLocaleDateString() : '-',
    ]);

    outputTable(['Name', 'ID', 'Created'], rows);
  } catch (err: unknown) {
    handleApiError(err);
  }
}

export function registerWorkspaceCommands(program: Command): void {
  const wsCmd = createWorkspacesCommand();
  program.addCommand(wsCmd);

  // Alias: ws
  const alias = createWorkspacesCommand();
  alias.name('ws').description('Manage workspaces (alias for "workspaces")');
  program.addCommand(alias);
}
