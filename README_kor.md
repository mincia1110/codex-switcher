# Codex Switcher (`cxs`)

WSL/Ubuntu용 CLI 전용 Codex 계정 런처입니다. `cxs`는 실제 `codex` CLI를 실행할 때 계정별 `CODEX_HOME`을 지정하여 여러 Codex 계정을 격리합니다.

이 도구는 **Desktop 전환기**가 아닙니다. `cxs run` 또는 Codex를 실행한 `cxs switch` 세션이 종료되면, 선택한 계정 인증을 `~/.codex`로 동기화해서 이후 plain `codex` 실행도 같은 계정을 사용하게 합니다.

## 핵심 모델

```text
~/.cxs/
  config.json
  accounts/
    personal/
      config.toml
      auth.json
      history.jsonl
      sessions/ -> ~/.cxs/shared/sessions
      logs/
  shared/
    sessions/
  cache/
    usage.json
```

Codex는 다음 방식으로 실행됩니다.

```bash
CODEX_HOME=~/.cxs/accounts/<account> codex ...
```

## 보안 규칙

- access token, refresh token, id token, account id는 `~/.cxs/config.json`에 기록하지 않습니다.
- usage cache에는 로컬 사용량 스냅샷만 저장하며 인증 secret은 저장하지 않습니다.
- 계정별 원본 `auth.json`은 각 계정 home 내부에 유지됩니다. `~/.codex/auth.json`은 plain `codex` 실행을 위한 직전 실행 계정의 복사본입니다.
- resume 세션은 `~/.cxs/shared/sessions`로 공유합니다. 계정별 `sessions` 경로는 이 공용 디렉터리를 가리키는 symlink이므로, 계정 인증을 공유하지 않고도 `/resume`에서 여러 `cxs` 계정의 세션을 볼 수 있습니다.
- 실행한 Codex 세션이 종료되면 해당 계정의 `auth.json`을 `~/.codex/auth.json`으로 mode `0600`으로 복사하고, `~/.codex/config.toml`에는 `cli_auth_credentials_store = "file"`을 보장하며, 기본 app-server control socket을 제거합니다. 이렇게 해야 plain `codex`가 다른 계정으로 떠 있는 remote app-server 세션을 재사용하지 않습니다.
- 가능하면 `auth.json` 권한을 `0600`으로 설정합니다.
- `cxs doctor`가 권한 및 설정 문제를 진단합니다.

## 설치

```bash
npm install
npm run build
npm link
```

요구사항:

- Node.js 20+
- WSL2/Ubuntu 또는 Linux shell
- `codex`가 `PATH`에 있어야 합니다. 또는 `CXS_CODEX_BIN=/absolute/path/to/codex`를 설정하세요.

## 명령어

### Login

```bash
cxs login personal
```

`~/.cxs/accounts/personal`을 생성하고, 다음 내용을 가진 `config.toml`을 작성합니다.

```toml
cli_auth_credentials_store = "file"
```

그 다음 아래 명령을 실행합니다.

```bash
CODEX_HOME=~/.cxs/accounts/personal codex login
```

### List

```bash
cxs list
```

계정명, 마스킹된 이메일, 기본 계정 표시, 마지막 사용 시간을 출력합니다.

### Use

```bash
cxs use work
```

기본 계정만 변경합니다. Codex는 실행하지 않습니다.

### Run

```bash
cxs run
cxs run personal
cxs run work -- exec "review this diff"
cxs run -- exec "use default account"
```

선택된 계정 home을 `CODEX_HOME`으로 지정하여 실제 `codex` 프로세스를 실행합니다.

Codex를 실행하기 전에 `cxs`는 등록된 계정들의 기존 `sessions` 디렉터리를 `~/.cxs/shared/sessions`로 병합하고, 각 계정의 `sessions` 디렉터리를 해당 공용 디렉터리 symlink로 교체합니다. `history.jsonl`과 `session_index.jsonl`도 `~/.cxs/shared` 아래로 병합/공유합니다. 그래서 `codex resume`과 `/resume`에서 다른 `cxs` 계정으로 만들었던 세션도 보입니다. 인증과 config는 계속 계정별로 유지됩니다.

Codex 프로세스가 종료되면 선택한 계정 인증을 기본 Codex home으로 동기화합니다. 예를 들어 `cxs run work` 종료 후 plain `codex`를 실행하면, 기존 `~/.codex`에 남아 있던 계정 대신 `work` 계정을 사용해야 합니다.

단, shell에 `CODEX_HOME`이 설정되어 있으면 plain `codex`는 `~/.codex` 대신 해당 디렉터리를 우선 사용합니다. 이 경우 `cxs`가 동기화 후 경고를 출력하며, 같은 shell에서 `unset CODEX_HOME`을 실행해야 동기화된 계정을 사용합니다.

또한 `cxs`는 동기화 후 기본 app-server control socket을 제거합니다. 그렇지 않으면 plain `codex`가 이전 계정을 캐시한 persistent remote app-server에 붙을 수 있습니다.

기본 Codex remote-control/app-server 세션을 의도적으로 유지하고 있다면, `cxs run` 또는 Codex를 실행한 `cxs switch` 이후 future plain `codex` 실행이 그 서버에서 분리될 수 있습니다. 이는 동기화된 로컬 계정이 적용되게 하기 위한 동작입니다.

### Switch

```bash
cxs switch
cxs switch --no-run
cxs switch --scan
cxs switch --sort quota
cxs switch --sort recent
cxs switch --sort name
```

`@clack/prompts`를 사용해 계정을 선택합니다. 기본 동작은 선택한 계정을 기본 계정으로 저장한 뒤 `codex`를 실행하는 것입니다. `--no-run`을 사용하면 기본 계정만 변경합니다.

`switch`가 Codex를 실행한 경우에도 해당 Codex 세션 종료 후 선택 계정을 `~/.codex`로 동기화합니다. `--no-run`은 `cxs` 기본 계정만 변경하고 `~/.codex`는 건드리지 않습니다.

### Usage

```bash
cxs usage
cxs usage --scan
cxs usage --json
```

다음 위치의 계정별 로컬 사용량 artifact를 스캔합니다.

```text
~/.cxs/accounts/<account>/sessions/**/*.jsonl
~/.cxs/accounts/<account>/logs/**/*.jsonl
~/.cxs/accounts/<account>/logs_*.sqlite
```

parser는 schema 변경에 관대하게 동작하며, `primary` 및 `secondary` usage window를 포함하는 `rate_limits` / `rateLimits` 형태의 객체를 인식합니다.

새 Codex CLI 버전은 JSONL 대신 `logs_*.sqlite`에 로컬 활동을 저장할 수 있습니다. quota/rate-limit payload가 로컬에 없으면 `cxs usage --scan`은 `response.completed` 사용량을 response id 기준으로 dedupe해서 `Tokens` 컬럼에 표시합니다. 이 fallback 모드에서는 로컬 로그에 quota 잔여 퍼센트가 없으므로 `5h left`와 `Week left`는 `?`로 유지됩니다.

usage 조회 실패는 `unknown`으로 표시되며, 계정 전환이나 Codex 실행을 막지 않습니다.

### Reset Credits

```bash
cxs reset-credits
cxs reset-credits work
cxs reset-credits --current
cxs reset-credits --timezone Asia/Seoul
```

Codex reset credit의 사용 가능 개수와 만료 시간을 안전한 요약으로 출력합니다. 기본값은 `cxs` 기본 계정이며, 계정명을 넘기면 해당 계정 home을 확인합니다. `--current`를 넘기면 plain Codex가 쓰는 `~/.codex/auth.json`을 확인합니다.

보안 규칙:
- `https://chatgpt.com/backend-api/wham/rate-limit-reset-credits` 엔드포인트만 호출합니다.
- local access token과 account id는 요청 header로만 사용합니다.
- 출력은 사용 가능 개수, 총 획득 개수, 만료 시간으로 제한합니다.
- token, account id, email, profile URL, credit id, cookie, raw endpoint response는 출력하지 않습니다.

### Doctor

```bash
cxs doctor
```

다음을 점검합니다.

- Node.js >= 20
- codex binary 존재 여부
- `~/.cxs` root
- config 유효성
- 기본 계정 유효성
- 계정 home/config/auth 파일
- auth 권한
- sessions/logs 읽기 가능 여부
- usage cache 경로

### Redacted diagnostics export

```bash
cxs export --redacted
cxs export --redacted --output /tmp/cxs-diagnostics.json
```

runtime metadata, 계정 설정 metadata, auth 파일 존재 여부/mode, sessions/logs 디렉터리 상태, usage-cache metadata를 포함하는 JSON 진단 번들을 내보냅니다.

이 번들은 raw email을 의도적으로 redact하며, `auth.json` token 값을 읽거나 출력하지 않습니다. output 파일은 가능하면 mode `0600`으로 작성됩니다.

### Shell completion

```bash
# bash
cxs completion bash > ~/.local/share/cxs/completion.bash
source ~/.local/share/cxs/completion.bash

# zsh
cxs completion zsh > ~/.local/share/cxs/_cxs
fpath=(~/.local/share/cxs $fpath)
autoload -Uz compinit && compinit
```

## 개발

```bash
npm install
npm test
npm run build
node dist/main.js --help
```

## fake Codex를 사용한 WSL smoke test

```bash
TMP=$(mktemp -d)
mkdir -p "$TMP/bin"
cat > "$TMP/bin/codex" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [ "${1:-}" = "login" ]; then
  mkdir -p "$CODEX_HOME"
  printf '{"user":{"email":"person@example.com"}}\n' > "$CODEX_HOME/auth.json"
  exit 0
fi
printf 'FAKE_CODEX_HOME=%s ARGS=%s\n' "$CODEX_HOME" "$*"
EOF
chmod +x "$TMP/bin/codex"

HOME="$TMP/home" PATH="$TMP/bin:$PATH" node dist/main.js login personal
HOME="$TMP/home" PATH="$TMP/bin:$PATH" node dist/main.js run personal -- exec 'hello world'
HOME="$TMP/home" PATH="$TMP/bin:$PATH" node dist/main.js run -- exec default
HOME="$TMP/home" PATH="$TMP/bin:$PATH" node dist/main.js usage --scan --json
HOME="$TMP/home" PATH="$TMP/bin:$PATH" node dist/main.js doctor
```

## 명시적 비목표

- PowerShell 의존성을 만들지 않습니다.
- Codex Desktop과 연동하지 않습니다.
- Chrome profile 또는 web state를 관리하지 않습니다.
- `~/.codex/auth.json`을 복사/swap/덮어쓰기 하지 않습니다.
- MVP에서는 unofficial backend API quota refresh를 제공하지 않습니다.
- MVP에서는 자동 `--best` 계정 선택을 제공하지 않습니다.

## 남은 개선안

- Optional `CXS_CODEX_BIN` 문서 확장 및 config-level override.
- MVP 이후 optional encrypted vault.
- 향후 안전한 API 기반 quota refresh가 가능해질 경우 명시적 `--refresh-all --confirm` flow.
