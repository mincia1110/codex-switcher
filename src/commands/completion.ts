export type CompletionShell = "bash" | "zsh";

const COMMANDS = "login list use run sync switch usage reset-credits doctor export completion";

export function completionScript(shell: CompletionShell): string {
  if (shell === "bash") {
    return `# cxs bash completion
_cxs_completions() {
  local cur prev commands
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  commands="${COMMANDS}"

  if [[ COMP_CWORD -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
    return 0
  fi

  case "\${COMP_WORDS[1]}" in
    switch)
      COMPREPLY=( $(compgen -W "--no-run --scan --sort" -- "$cur") )
      ;;
    sync)
      COMPREPLY=( $(compgen -W "--dry-run" -- "$cur") )
      ;;
    usage)
      COMPREPLY=( $(compgen -W "--scan --refresh --json" -- "$cur") )
      ;;
    reset-credits)
      COMPREPLY=( $(compgen -W "--current --timezone" -- "$cur") )
      ;;
    export)
      COMPREPLY=( $(compgen -W "--redacted --output" -- "$cur") )
      ;;
    completion)
      COMPREPLY=( $(compgen -W "bash zsh" -- "$cur") )
      ;;
  esac
}
complete -F _cxs_completions cxs
`;
  }

  if (shell === "zsh") {
    return `#compdef cxs

_cxs() {
  local -a commands
  commands=(
    'login:Create/login a Codex account'
    'list:List configured Codex accounts'
    'use:Set default account without running Codex'
    'run:Run codex with default or named account'
    'sync:Sync account auth to default Codex home'
    'switch:Interactively select account and run codex'
    'usage:Show local/cache usage for all accounts'
    'reset-credits:Show safe Codex reset credit summary'
    'doctor:Diagnose cxs/codex/account setup'
    'export:Export a redacted diagnostics bundle'
    'completion:Print shell completion script'
  )

  _arguments \
    '1:command:->command' \
    '*::arg:->args'

  case $state in
    command)
      _describe 'command' commands
      ;;
    args)
      case \${words[2]} in
        switch)
          _values 'switch options' '--no-run' '--scan' '--sort[sort order]:mode:(default quota recent name)'
          ;;
        sync)
          _values 'sync options' '--dry-run'
          ;;
        usage)
          _values 'usage options' '--scan' '--refresh' '--json'
          ;;
        reset-credits)
          _values 'reset credit options' '--current' '--timezone[timezone for expiry dates]:zone:'
          ;;
        export)
          _values 'export options' '--redacted' '--output[write JSON bundle to file]:path:_files'
          ;;
        completion)
          _values 'shell' bash zsh
          ;;
      esac
      ;;
  esac
}

_cxs "$@"
`;
  }

  throw new Error(`Unsupported shell: ${shell}`);
}

export async function completionCommand(shell: CompletionShell): Promise<void> {
  process.stdout.write(completionScript(shell));
}
