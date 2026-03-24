import { Command } from 'commander';
import { setJsonMode, setVerboseMode } from './lib/output.js';
import { registerLoginCommands } from './commands/login.js';
import { registerWorkspaceCommands } from './commands/workspaces.js';
import { registerComputerCommands } from './commands/computers.js';
import { registerAgentCommands } from './commands/agents.js';
import { registerTemplateCommands } from './commands/templates.js';

const program = new Command();

program
  .name('bnb')
  .description('CLI for the Bottleneck Bots cloud desktop platform')
  .version('0.1.0')
  .option('--json', 'Output raw JSON instead of formatted tables')
  .option('--verbose', 'Show request/response details for debugging')
  .option('--workspace <id>', 'Override active workspace ID')
  .hook('preAction', (_thisCommand, actionCommand) => {
    // Resolve global flags from root command
    const root = actionCommand.optsWithGlobals();
    if (root.json) setJsonMode(true);
    if (root.verbose) setVerboseMode(true);
  });

// Register all command groups
registerLoginCommands(program);
registerWorkspaceCommands(program);
registerComputerCommands(program);
registerAgentCommands(program);
registerTemplateCommands(program);

// Shell completion subcommand
program
  .command('completion')
  .description('Generate shell completion script')
  .argument('[shell]', 'Shell type: bash, zsh, or fish', 'bash')
  .action((shell: string) => {
    if (shell === 'bash') {
      console.log(generateBashCompletion());
    } else if (shell === 'zsh') {
      console.log(generateZshCompletion());
    } else if (shell === 'fish') {
      console.log(generateFishCompletion());
    } else {
      console.error(`Unsupported shell: ${shell}. Use bash, zsh, or fish.`);
      process.exit(1);
    }
  });

program.parse();

// ---------------------------------------------------------------------------
// Completion generators
// ---------------------------------------------------------------------------

function generateBashCompletion(): string {
  return `# bnb bash completion
# Add to ~/.bashrc: eval "$(bnb completion bash)"
_bnb_completions() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local prev="\${COMP_WORDS[COMP_CWORD-1]}"
  local commands="login logout whoami workspaces ws computers vm agents templates completion"
  local ws_sub="create delete use members invite"
  local vm_sub="create start stop destroy ssh screenshot vnc logs"
  local ag_sub="deploy status logs stop restart destroy"
  local tp_sub="create build logs delete"

  case "\${prev}" in
    bnb)
      COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
      ;;
    workspaces|ws)
      COMPREPLY=( $(compgen -W "\${ws_sub}" -- "\${cur}") )
      ;;
    computers|vm)
      COMPREPLY=( $(compgen -W "\${vm_sub}" -- "\${cur}") )
      ;;
    agents)
      COMPREPLY=( $(compgen -W "\${ag_sub}" -- "\${cur}") )
      ;;
    templates)
      COMPREPLY=( $(compgen -W "\${tp_sub}" -- "\${cur}") )
      ;;
  esac
}
complete -F _bnb_completions bnb`;
}

function generateZshCompletion(): string {
  return `# bnb zsh completion
# Add to ~/.zshrc: eval "$(bnb completion zsh)"
_bnb() {
  local -a commands subcommands
  commands=(
    'login:Authenticate with the Bottleneck Bots API'
    'logout:Remove stored credentials'
    'whoami:Show current user and workspace'
    'workspaces:Manage workspaces'
    'ws:Manage workspaces (alias)'
    'computers:Manage computers'
    'vm:Manage computers (alias)'
    'agents:Manage agents'
    'templates:Manage templates'
    'completion:Generate shell completion script'
  )

  _arguments -C \\
    '--json[Output raw JSON]' \\
    '--verbose[Show request details]' \\
    '--workspace[Override workspace ID]:workspace id:' \\
    '1: :->command' \\
    '*::arg:->args'

  case $state in
    command)
      _describe 'command' commands
      ;;
    args)
      case $words[1] in
        workspaces|ws)
          subcommands=('create' 'delete' 'use' 'members' 'invite')
          _describe 'subcommand' subcommands
          ;;
        computers|vm)
          subcommands=('create' 'start' 'stop' 'destroy' 'ssh' 'screenshot' 'vnc' 'logs')
          _describe 'subcommand' subcommands
          ;;
        agents)
          subcommands=('deploy' 'status' 'logs' 'stop' 'restart' 'destroy')
          _describe 'subcommand' subcommands
          ;;
        templates)
          subcommands=('create' 'build' 'logs' 'delete')
          _describe 'subcommand' subcommands
          ;;
      esac
      ;;
  esac
}
compdef _bnb bnb`;
}

function generateFishCompletion(): string {
  return `# bnb fish completion
# Add to ~/.config/fish/completions/bnb.fish
complete -c bnb -n '__fish_use_subcommand' -a login -d 'Authenticate with the Bottleneck Bots API'
complete -c bnb -n '__fish_use_subcommand' -a logout -d 'Remove stored credentials'
complete -c bnb -n '__fish_use_subcommand' -a whoami -d 'Show current user and workspace'
complete -c bnb -n '__fish_use_subcommand' -a workspaces -d 'Manage workspaces'
complete -c bnb -n '__fish_use_subcommand' -a ws -d 'Manage workspaces (alias)'
complete -c bnb -n '__fish_use_subcommand' -a computers -d 'Manage computers'
complete -c bnb -n '__fish_use_subcommand' -a vm -d 'Manage computers (alias)'
complete -c bnb -n '__fish_use_subcommand' -a agents -d 'Manage agents'
complete -c bnb -n '__fish_use_subcommand' -a templates -d 'Manage templates'
complete -c bnb -n '__fish_seen_subcommand_from workspaces ws' -a 'create delete use members invite'
complete -c bnb -n '__fish_seen_subcommand_from computers vm' -a 'create start stop destroy ssh screenshot vnc logs'
complete -c bnb -n '__fish_seen_subcommand_from agents' -a 'deploy status logs stop restart destroy'
complete -c bnb -n '__fish_seen_subcommand_from templates' -a 'create build logs delete'`;
}
