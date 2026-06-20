# Codex Auth With cxs

`cxs`는 여러 Codex 계정을 계정별 home에 저장하고, 선택 계정을 plain `codex`와 Codex App SSH remote project가 쓰는 기본 home으로 sync한다.

## 핵심 구조

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
    business/
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

기본 실행 모델:

```bash
cxs run <account>  # cxs sync <account> 후 plain codex 실행
```

격리 실행이 필요하면 다음을 쓴다.

```bash
cxs run --isolated <account>
```

보안 원칙:

- `~/.cxs/config.json`에는 access token, refresh token, id token, account id를 저장하지 않는다.
- 계정별 원본 `auth.json`은 `~/.cxs/accounts/<account>/auth.json`에 둔다.
- `~/.codex/auth.json`은 plain `codex`와 Codex App SSH remote project를 위한 active account 복사본이다.
- 문서, 로그, dry-run 출력에 token 값을 출력하지 않는다.

## 계정 등록

```bash
cxs login personal
cxs login business
cxs doctor
```

`cxs login <name>`은 계정 home을 만들고 다음 설정을 쓴 뒤 Codex 로그인을 실행한다.

```toml
cli_auth_credentials_store = "file"
```

## 계정 사용

기본 계정만 바꾸기:

```bash
cxs use personal
```

선택 계정으로 Codex 실행:

```bash
cxs run personal
cxs run business -- exec "review this diff"
cxs run --isolated business
```

기본 `cxs run <account>`는 먼저 `~/.codex/auth.json`과 `~/.codex/config.toml`을 sync한 뒤, `CODEX_HOME` 없이 plain `codex`를 실행한다. 따라서 `~/.codex/config.toml`의 custom provider 설정을 그대로 사용한다.

`cxs run --isolated <account>`는 기존 방식처럼 `CODEX_HOME=~/.cxs/accounts/<account>`로 실행한다. 이 경우 provider 설정도 계정별 `config.toml`에 있어야 한다.

대화형 선택:

```bash
cxs switch
cxs switch --no-run
cxs switch --sort quota
```

사용량:

```bash
cxs usage
cxs usage --refresh
cxs usage --scan
cxs usage --json
```

## Active Auth Sync

Mac mini에서 plain `codex` 또는 Codex App SSH remote project가 쓸 active auth를 바꾼다.

```bash
cxs sync personal
cxs sync business
cxs sync --dry-run
cxs sync personal --dry-run
```

`cxs sync <account>` 동작:

- `~/.cxs/accounts/<account>/auth.json` 존재 확인
- `~/.codex/auth.json`으로 복사
- `~/.codex/auth.json` mode `0600` 보장
- `~/.codex/config.toml`에 `cli_auth_credentials_store = "file"` 보장
- 기본 app-server control socket 제거
- sync 성공 시 해당 account를 default account로 설정

`--dry-run`은 파일을 수정하지 않고 source/destination 경로와 예정 작업만 출력한다. token 값은 출력하지 않는다.

## Remote Project와의 관계

원격 개발 호스트에 Codex App SSH remote project로 붙는 경우, 실제 Codex auth는 클라이언트 쪽이 아니라 원격 호스트의 active auth를 따른다.

안전한 전환 흐름:

```bash
ssh dev-host 'cxs sync personal'
# Codex App remote project 열기

ssh dev-host 'cxs sync business'
# 기존 remote project 닫고 다시 열기
```

계정 전환 시 주의:

- 이미 열린 remote app-server 세션은 이전 계정을 캐시할 수 있다.
- `cxs sync`는 기본 app-server control socket을 제거해 plain `codex`가 stale session에 붙는 위험을 줄인다.
- remote project는 닫았다가 sync 후 다시 여는 방식이 가장 예측 가능하다.
- 현재 셸에 `CODEX_HOME`이 설정되어 있으면 plain `codex`가 `~/.codex`를 무시할 수 있으므로 `unset CODEX_HOME`을 확인한다.

## 진단

```bash
cxs doctor
cxs export --redacted --output /tmp/cxs-diagnostics.json
```

`export --redacted`는 token 값을 읽거나 출력하지 않는 진단 번들을 만든다.
