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

Set `LLM_API_KEY` in your local, ignored `.env` file to use the default Gemini provider. The default model is `gemini-3.6-flash`.

```sh
pnpm run build
node dist/cli.js process test/fixtures/fixture-a-valid.jsonl
```

For human-friendly tabular inspection with formatted review explanations:

```sh
node dist/cli.js process test/fixtures/fixture-a-valid.jsonl --format=table
```

To use Anthropic or OpenAI, also set `LLM_PROVIDER` to `anthropic` or `openai`, and provide an explicit `LLM_MODEL`. Keep the provider API key in `LLM_API_KEY`.

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

Gemini has passed a live CLI check. Anthropic and OpenAI have offline mocked coverage; live qualification is pending. The current flow makes one model request per message. Representative latency and cost have not yet been measured.

## With another day

Evaluate the pipeline on independently labeled messages. Compare extracted values and review outcomes against those labels, and record per-message latency and token usage so provider quality and operating cost can be assessed.

For architecture, decisions, phase plans, and historical verification evidence, see the [documentation index](docs/README.md).
