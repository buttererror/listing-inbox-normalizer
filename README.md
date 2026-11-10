# Dwelleo

Dwelleo processes broker messages through the CLI and serves an HTTP liveness endpoint. It accepts a JSONL file containing multiple broker messages and produces one contract-compliant JSON result per nonblank input line in input order, supporting sales, rentals, multiple offers, mixed messages, projects, buyer requests, and irrelevant messages. An optional table format (`--format=table`) presents human-friendly review explanations and structured columns for review. The [roadmap](docs/roadmap.md) describes planned capabilities and their delivery order.

## Requirements

- Node.js 24
- pnpm 10.28.2

Install dependencies with:

```sh
pnpm install --frozen-lockfile
```

Corepack is optional. Use it to run the pnpm version pinned in `package.json` if pnpm 10.28.2 is not installed directly:

```sh
corepack pnpm install --frozen-lockfile
```

## CLI quick start

Set `LLM_API_KEY` in your local, ignored `.env` file to use the default Gemini provider (`gemini-3.6-flash`).

```sh
pnpm run build
node dist/cli.js process test/fixtures/fixture-a-valid.jsonl
```

For human-friendly tabular inspection with formatted review explanations:

```sh
node dist/cli.js process test/fixtures/fixture-a-valid.jsonl --format=table
```

To switch to another API provider (`anthropic`, `openai`) or a local CLI provider (`claude-cli`, `agy`), see [LLM providers and configuration](#llm-providers-and-configuration) below.

## LLM providers and configuration

All environment configuration is validated by Zod in [`src/config/env.ts`](src/config/env.ts) (loading `.env` automatically when present). Blank or whitespace-only values (for example `LLM_MODEL=` in `.env`) are treated as unset so configured defaults still apply.

### Supported providers

| `LLM_PROVIDER` | Transport | Auth / credentials | `LLM_MODEL` | Structured output & tool posture | Current status |
| --- | --- | --- | --- | --- | --- |
| `gemini` *(default)* | Direct API ([`AiSdkGateway`](src/llm-gateway/ai-sdk.gateway.ts)) | `LLM_API_KEY` | Optional (defaults to `gemini-3.6-flash`) | Native JSON schema, tool-less | Live CLI check passed (`D-024`, `D-038`) |
| `anthropic` | Direct API ([`AiSdkGateway`](src/llm-gateway/ai-sdk.gateway.ts)) | `LLM_API_KEY` | **Required** | Native `outputFormat` JSON schema, tool-less | Offline mocked tests; live check pending |
| `openai` | Direct API ([`AiSdkGateway`](src/llm-gateway/ai-sdk.gateway.ts)) | `LLM_API_KEY` | **Required** | Strict JSON schema, tool-less | Offline mocked tests; live check pending |
| `claude-cli` *(alias `claude`)* | Local `claude` CLI ([`ClaudeCliGateway`](src/llm-gateway/claude-cli.gateway.ts)) | Local `claude` auth (`claude /login` OAuth or `ANTHROPIC_API_KEY`; `LLM_API_KEY` ignored) | Optional (uses CLI default if omitted; e.g. `sonnet`, `haiku`, or model ID) | `--json-schema`, `--tools ""`, `--strict-mcp-config`, `--disable-slash-commands`, `--no-session-persistence`, `cwd: os.tmpdir()` | Offline mocked tests; live check pending (`D-041`) |
| `agy` *(alias `antigravity`)* | Local `agy` CLI ([`AgyGateway`](src/llm-gateway/agy.gateway.ts)) | Local `agy` OAuth (`LLM_API_KEY` ignored) | Optional (uses CLI default if omitted) | `--sandbox`, `--json-schema`, `--disable-slash-commands`, `cwd: os.tmpdir()` | Phase 03 20-case evaluation verified (`1.5.3` / `gemini-3.8-flash-low`, `D-039`) |

### Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PORT` | No | `3000` | HTTP server port (`1`–`65535`). |
| `DATABASE_URL` | No | `file:./dev.db` | SQLite database path used by Prisma and [`DatabaseService`](src/database/database.service.ts). |
| `LLM_PROVIDER` | No | `gemini` | One of `gemini`, `anthropic`, `openai`, `claude-cli`, `claude`, `agy`, `antigravity`. |
| `LLM_MODEL` | `anthropic` / `openai` only | `gemini-3.6-flash` for `gemini`; omitted for CLI providers | Explicit model identifier (or Claude CLI alias such as `sonnet` / `opus` / `haiku`). |
| `LLM_API_KEY` | API providers only | — | API credential for `gemini`, `anthropic`, and `openai`. Ignored by `claude-cli` and `agy`. |
| `LLM_TIMEOUT_MS` | No | `45000` | Positive integer request/subprocess timeout in milliseconds. |
| `CLAUDE_EXECUTABLE` | No | `~/.local/bin/claude` (or `.exe` on Windows) if present, else `claude` | Path or command name for the `claude` CLI binary. |
| `AGY_EXECUTABLE` | No | `~/.local/bin/agy` (or `.exe` on Windows) if present, else `agy` | Path or command name for the `agy` CLI binary. |
| `DWELLEO_TELEMETRY` | No | Unset | Set to `1` to emit single-line `DWELLEO_TELEMETRY` JSON diagnostics (provider, model, duration, tokens, errors) to `stderr` without modifying `stdout`. |

### Direct API providers (`gemini`, `anthropic`, `openai`)

API providers run through [`AiSdkGateway`](src/llm-gateway/ai-sdk.gateway.ts) with `maxRetries: 0`, no tools, and native schema constraints:

```sh
# Gemini (default)
LLM_PROVIDER=gemini LLM_API_KEY=your_key node dist/cli.js process test/fixtures/fixture-a-valid.jsonl

# Anthropic direct API
LLM_PROVIDER=anthropic LLM_MODEL=claude-sonnet-4-6 LLM_API_KEY=your_key node dist/cli.js process test/fixtures/fixture-a-valid.jsonl

# OpenAI direct API
LLM_PROVIDER=openai LLM_MODEL=gpt-4.1-mini LLM_API_KEY=your_key node dist/cli.js process test/fixtures/fixture-a-valid.jsonl
```

### Claude Code CLI (`claude-cli` / `claude`)

Use `LLM_PROVIDER=claude-cli` (or alias `claude`) to run extraction through a locally installed and authenticated Anthropic Claude Code CLI (`claude`) instead of the direct API (`LLM_PROVIDER=anthropic`).

1. **Install & authenticate `claude` CLI**:
   Verify `claude --version` works in your shell, then authenticate either via your Claude subscription (`claude` -> `/login` OAuth) or by exporting `ANTHROPIC_API_KEY` in your shell environment. Note that Claude CLI warns if both an active OAuth session and `ANTHROPIC_API_KEY` are set simultaneously.
2. **Credential isolation (`LLM_API_KEY` vs `ANTHROPIC_API_KEY`)**:
   `claude-cli` **ignores `LLM_API_KEY`** and never forwards it as `ANTHROPIC_API_KEY`. This keeps existing `.env` files containing a Gemini `LLM_API_KEY` safe when switching `LLM_PROVIDER=claude-cli`. Conversely, if you want API-key billing with `claude-cli`, set `ANTHROPIC_API_KEY` (or use `LLM_PROVIDER=anthropic` with `LLM_API_KEY`).
3. **Run via CLI or `.env`**:

   ```sh
   # Uses local claude CLI default model
   LLM_PROVIDER=claude-cli node dist/cli.js process test/fixtures/one-message.jsonl

   # Override model and capture telemetry on stderr
   LLM_PROVIDER=claude-cli LLM_MODEL=sonnet DWELLEO_TELEMETRY=1 node dist/cli.js process test/fixtures/one-message.jsonl

   # Override executable path if claude is not on PATH
   LLM_PROVIDER=claude-cli CLAUDE_EXECUTABLE=/custom/path/claude node dist/cli.js process test/fixtures/one-message.jsonl
   ```

4. **How `ClaudeCliGateway` executes safely & headlessly**:
   - Invokes `claude -p ... --output-format json --json-schema <schema> --system-prompt <instructions> --tools "" --strict-mcp-config --disable-slash-commands --no-session-persistence` (plus `--model <LLM_MODEL>` when set) with `cwd: os.tmpdir()`.
   - Pipes the untrusted broker message via `stdin` rather than CLI arguments, avoiding shell quoting/length issues on Windows and preventing messages starting with `-` from being interpreted as flags.
   - Disables built-in tools (`--tools ""`), MCP discovery (`--strict-mcp-config`), slash commands/skills (`--disable-slash-commands`), and session persistence (`--no-session-persistence`) while preserving OAuth keychain auth (which `--bare` would skip).
   - Maps spawn failures, non-zero exit codes, malformed JSON, and `is_error: true` responses to `provider_unavailable`; kills timed-out subprocesses (`SIGKILL`) as `provider_timeout`; and maps `error_max_structured_output_retries` (without `structured_output`) to `invalid_extraction` via Stage 2 validation.

### Antigravity CLI (`agy` / `antigravity`)

Use `LLM_PROVIDER=agy` (or `antigravity`) to invoke the local Antigravity CLI (`--sandbox`, `--json-schema`, `--disable-slash-commands`, `cwd: os.tmpdir()`) using its local OAuth session (`LLM_API_KEY` is ignored; override binary path with `AGY_EXECUTABLE` if needed).

## HTTP liveness

```sh
pnpm start
```

This command builds the application and starts the HTTP server. By default, `GET /health` listens on port `3000` and reports liveness; startup does not process messages. Set `PORT` to change the port.

Run the offline test suite with:

```sh
pnpm test
```

## Provider status and limits

The direct tool-less Gemini API (`gemini-3.6-flash` default) has passed a live CLI check (`D-024`, `D-038`); direct `anthropic`, `openai`, and local `claude-cli` currently have offline mocked coverage with live qualification pending (`D-026`, `D-041`). The `agy` CLI gateway (`1.5.3` / `gemini-3.8-flash-low`) completed Phase 03 independent evaluation across 20 cases. Each message makes one model extraction request; SQLite persistence, HTTP ingestion endpoints, and duplicate detection remain scoped to Phases 04–05.

## Independent evaluation (Phase 03)

Phase 03 evaluated Dwelleo's end-to-end public CLI output (`2026-11-10`) against **20 independently authored Saudi real-estate messages** ([`test/evaluation/cases.jsonl`](test/evaluation/cases.jsonl), [`expected.json`](test/evaluation/expected.json) v1.0.0: 8 Arabic, 6 English, 6 Mixed; 16 expected offers across 14 listing/mixed messages plus 2 buyer requests, 2 project announcements, and 2 irrelevant messages).

- **Provider & model:** `agy` CLI `1.5.3`, model `gemini-3.8-flash-low` (`LLM_PROVIDER=agy`, `LLM_MODEL=gemini-3.8-flash-low`).
- **Post-baseline change (Task 03.5):** Aligned candidate key descriptions in [`src/extraction/domain-prompt.ts`](src/extraction/domain-prompt.ts) with `stage1GatewayWireSchema` (clarifying `kind` on `area_sqm` and `role` on `price` as top-level sibling keys of `value`, and disallowing extra keys on `price.value`). Stage 2 strict validation and frozen expected labels were unchanged.

| Metric | Baseline (Task 03.4) | Post-Fix (Task 03.5) |
|---|---:|---:|
| **Classification accuracy** | `20/20 (100.0%)` | `20/20 (100.0%)` |
| **Detected-class accuracy** | `20/20 (100.0%)` | `20/20 (100.0%)` |
| **Offer-count accuracy** | `20/20 (100.0%)` | `20/20 (100.0%)` |
| **Field accuracy (applicable)** | `137/171 (80.1%)` | **`169/171 (98.8%)`** |
| **Unsupported-value acceptance** | `0/26 (0.0%)` | `0/26 (0.0%)` |
| **Supported-value omission** | `34/150 (22.7%)` | **`2/150 (1.3%)`** |
| **Review precision** | `12/16 (75.0%)` | **`12/13 (92.3%)`** |
| **Review recall** | `12/12 (100.0%)` | `12/12 (100.0%)` |
| **Mean / median gateway latency** | `10,758.5 ms` / `11,637.3 ms` | **`6,804.4 ms` / `4,929.8 ms`** (`1,855.3`–`21,304.5 ms`) |
| **Input / output tokens (20 calls)** | `591,931` / `17,510` | **`330,563` / `11,703`** (`16,528.2` / `585.1` avg) |

- **Observed error examples:**
  - *Baseline (resolved in Task 03.5):* Without token-level grammar constraint in `agy`, the model nested `role` inside `price.value` (`12/12` valid asking prices rejected as `price_unsupported`) and misplaced `kind` on `area_sqm` (`8/12` valid areas rejected as `area_sqm_unsupported`).
  - *Remaining post-fix (6 mismatches across 4 cases):* `eval-015` and `eval-018` flagged synthetic `052...` mobile numbers as `contact_phone_uncertain` (`2/150` supported omissions; `1` false-positive review on `eval-015`); `eval-004` (per-sqm rate) and `eval-019` (unspecified rental period) emitted `price_uncertain` instead of `price_missing` and `price_period_unknown` while accurately keeping `price.amount: null` and `needs_review: true`.
- **Cost, telemetry, and assumptions:**
  - The evaluation runner sets `DWELLEO_TELEMETRY=1` for its CLI subprocess and captures opt-in stderr telemetry to `evaluation-results/telemetry.jsonl` without polluting public stdout JSONL.
  - Recorded durations cover the provider request per message (including internal `agy` retries), excluding ~1s one-time CLI startup and <1ms downstream resolution/review. `agy` injects agent system context (`~10k–33k` input tokens/call even with `cwd: os.tmpdir()`), and `output_tokens` includes reasoning/thinking tokens.
  - **USD cost is unavailable / omitted:** `agy` (`1.5.3`) authenticates via Antigravity OAuth quota rather than pay-as-you-go API billing, and `gemini-3.8-flash-low` has no published public USD rate card; token usage is reported directly rather than inventing cost estimates.
  - **Scope caveat:** Results on 20 synthetic cases measure this frozen evaluation corpus only and do not establish production-level accuracy or hidden-test performance.
- **Commands & verification results (2026-11-10):**
  - `pnpm test`: `20/20` offline test suites passed (`228/228` tests, no API key required).
  - `pnpm run typecheck` and `pnpm run build`: passed with zero errors.
  - `LLM_PROVIDER=agy LLM_MODEL=gemini-3.8-flash-low pnpm ts-node scripts/evaluate.ts --cases test/evaluation/cases.jsonl --expected test/evaluation/expected.json --output-dir evaluation-results/post-fix`: `20/20` scored, `0` provider failures (pass `--actual <path.jsonl>` to re-score saved CLI outputs offline without provider calls).
  - Full case-by-case breakdown and error analysis: [Baseline & Post-Fix Evaluation Analysis](docs/evaluation-baseline-analysis.md).

## With another day

Implement SQLite persistence, HTTP ingestion/listing/approval endpoints (`POST /messages`, `GET /listings`, `POST /listings/{id}/approve`) in Phase 04, and cross-broker deduplication in Phase 05, followed by live-model qualification against the direct REST Gemini API (`gemini-3.6-flash`).

For architecture, decisions, phase plans, and historical verification evidence, see the [documentation index](docs/README.md).
