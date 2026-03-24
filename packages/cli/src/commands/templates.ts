import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { api, handleApiError } from '../lib/api-client.js';
import {
  outputTable, success, error, info, spinner, statusBadge,
  isJsonMode, outputJson, outputDetail,
} from '../lib/output.js';

interface Template {
  id: string;
  name?: string;
  tags?: string[];
  size?: number;
  status?: string;
  base?: string;
  created?: string;
  createdAt?: string;
}

interface TemplatesResponse {
  templates: Template[];
}

interface TemplateResponse {
  template: Template;
}

interface BuildResponse {
  build: {
    id: string;
    status: string;
    tag: string;
  };
}

interface LogsResponse {
  logs: string;
}

export function registerTemplateCommands(program: Command): void {
  const cmd = new Command('templates')
    .description('Manage templates')
    .action(listTemplates);

  cmd
    .command('list')
    .description('List all available templates')
    .action(listTemplates);

  cmd
    .command('create')
    .description('Create a new template definition')
    .argument('<name>', 'Template name')
    .option('--base <image>', 'Base image', 'bottleneck-desktop-base:latest')
    .action(async (name: string, opts: { base: string }) => {
      try {
        const spin = spinner(`Creating template "${name}"...`);
        const data = await api<BuildResponse>('/api/v1/templates/build', {
          method: 'POST',
          body: {
            name,
            base: opts.base,
            instructions: [],
          },
        });
        spin.succeed(`Template created: ${name}`);

        if (isJsonMode()) {
          outputJson(data);
        } else {
          outputDetail({
            'Name': name,
            'Base': opts.base,
            'Status': statusBadge(data.build?.status || 'created'),
          });
        }
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  cmd
    .command('build')
    .description('Trigger a template build')
    .argument('<name>', 'Template name')
    .option('--base <image>', 'Base image', 'bottleneck-desktop-base:latest')
    .option('--run <commands...>', 'RUN instructions to include')
    .action(async (name: string, opts: { base: string; run?: string[] }) => {
      try {
        const instructions = (opts.run || []).map(cmd => ({
          type: 'run' as const,
          args: [cmd],
        }));

        const spin = spinner(`Building template "${name}"...`);
        const data = await api<BuildResponse>('/api/v1/templates/build', {
          method: 'POST',
          body: {
            name,
            base: opts.base,
            instructions,
          },
        });
        spin.succeed(`Template build started: ${name}`);

        if (isJsonMode()) {
          outputJson(data);
        } else {
          outputDetail({
            'Tag': data.build?.tag || `bottleneck-template-${name}:latest`,
            'Status': statusBadge(data.build?.status || 'building'),
          });
        }
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  cmd
    .command('logs')
    .description('View build logs for a template')
    .argument('<id>', 'Template ID or name')
    .action(async (id: string) => {
      try {
        const spin = spinner('Fetching build logs...');
        const data = await api<LogsResponse>(`/api/v1/templates/${id}/logs`);
        spin.stop();

        if (isJsonMode()) {
          outputJson(data);
        } else {
          console.log(data.logs || chalk.gray('(no build logs)'));
        }
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  cmd
    .command('delete')
    .description('Delete a template')
    .argument('<id>', 'Template ID')
    .option('-f, --force', 'Skip confirmation')
    .action(async (id: string, opts: { force?: boolean }) => {
      try {
        if (!opts.force) {
          const { confirm } = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: `Delete template ${id}? This cannot be undone.`,
            default: false,
          }]);
          if (!confirm) {
            info('Cancelled.');
            return;
          }
        }

        const spin = spinner('Deleting template...');
        await api(`/api/v1/templates/${id}`, { method: 'DELETE' });
        spin.succeed(`Template ${id} deleted.`);
      } catch (err: unknown) {
        handleApiError(err);
      }
    });

  program.addCommand(cmd);
}

async function listTemplates(): Promise<void> {
  try {
    const spin = spinner('Fetching templates...');
    const data = await api<TemplatesResponse>('/api/v1/templates');
    spin.stop();

    if (isJsonMode()) {
      outputJson(data.templates);
      return;
    }

    if (!data.templates || data.templates.length === 0) {
      info('No templates found. Create one with "bnb templates create <name>".');
      return;
    }

    const rows = data.templates.map((t: Template) => [
      t.name || (t.tags ? t.tags[0] : t.id.slice(0, 12)),
      t.id.slice(0, 12),
      statusBadge(t.status || 'ready'),
      t.size ? `${Math.round(t.size / 1024 / 1024)}MB` : '-',
      t.created || t.createdAt
        ? new Date(t.created || t.createdAt!).toLocaleDateString()
        : '-',
    ]);

    outputTable(['Name', 'ID', 'Status', 'Size', 'Created'], rows);
  } catch (err: unknown) {
    handleApiError(err);
  }
}
