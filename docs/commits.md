# Commit convention

Follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/). The type and breaking-change syntax follow that specification; the scopes and writing rules below are project conventions.

## Message format

```text
type(scope): short description

Optional body explaining the reason, important consequences, and validation.

Optional footers
```

- Use a lowercase type and an optional lowercase scope.
- Write an imperative description: `add`, `fix`, `preserve`, or `reject`.
- Aim for a subject of 72 characters or fewer, without a trailing period.
- Describe the resulting behavior or concrete change. Avoid vague subjects such as `update files` or `fix stuff`.
- Add a body when the reason or tradeoff is not clear from the subject. Report checks actually performed; do not claim unrun checks passed.
- Reference an issue only when one exists, for example `Refs: #12`. Use `Closes: #12` only when the commit completes that issue.

## Types

| Type | Use |
| --- | --- |
| `feat` | Add application capability or change externally observable behavior intentionally. |
| `fix` | Correct defective behavior, including unsupported extracted values. |
| `docs` | Change documentation or agent instructions only. |
| `test` | Add or improve tests without changing application behavior. |
| `refactor` | Restructure implementation while preserving behavior. |
| `perf` | Improve performance while preserving intended behavior. |
| `build` | Change dependency versions, lockfiles, compiler settings, or build tooling. |
| `ci` | Change continuous-integration configuration. |
| `style` | Change formatting only, without changing behavior. |
| `chore` | Maintain the repository when no more specific type fits. |
| `revert` | Undo a previous commit; identify its hash and the reason in the body. |

Choose the type by the purpose of the whole change. A feature with its tests and documentation remains a `feat` commit; tests do not need to be separated from the behavior they protect. Use `build` for dependency updates rather than treating every setup change as a `chore`.

## Scopes

Scopes are optional. Prefer an existing responsibility over a filename or a temporary task name.

| Scope | Responsibility |
| --- | --- |
| `messages` | Ingestion and shared processing orchestration |
| `extraction` | Classification, property segmentation, candidate facts, evidence, and schemas |
| `listings` | Normalization, deduplication, review policy, and approval |
| `llm` | Gateway execution and provider adapters |
| `db` | Prisma, SQLite, persistence, and migrations |
| `api` | HTTP transport and cross-feature API behavior |
| `cli` | Command-line input/output and process lifecycle |
| `config` | Application environment configuration |
| `deps` | Dependency updates |
| `agents` | Repository agent instructions and collaboration conventions |

Omit the scope when a change spans the application. Add a new scope only when it names a lasting responsibility; this is a preferred vocabulary, not a requirement to force every change into a module.

## Breaking changes

Mark incompatible changes to HTTP/CLI contracts, configuration, or persisted data with `!` before the colon. For this project, also include a `BREAKING CHANGE:` footer describing the impact and required migration or caller action. The specification permits either marker; using both is our project convention.

```text
feat(cli)!: distinguish processing failures from successful results

BREAKING CHANGE: consumers must handle the failure result variant described
in the CLI contract before upgrading.
```

Mark compatibility breaks during initial development as well as after release. Commit types communicate intent; this repository does not currently automate releases or version bumps.

## Commit boundaries and agent evidence

- Keep each commit focused on one coherent change that can be reviewed and explained.
- Include related tests, documentation, and decision references with the change they support.
- Split unrelated fixes, features, and cleanup. Avoid a single final commit containing the whole assessment.
- Preserve `PLAN.md` as the original baseline. Record later choices and deviations in the decision register.
- Record significant agent prompts and real corrections in the session log. Describe the engineering change in the commit subject; the log provides the AI supervision evidence.
- Create commits only after explicit user authorization. Documenting this convention does not authorize a commit, push, history rewrite, or publication.

## Project examples

These illustrate naming; they do not claim the features are implemented.

```text
docs: record the initial implementation plan
build: configure the NestJS and SQLite foundation
docs(agents): define repository working agreements
feat(api): expose the application health endpoint
feat(extraction): extract separate candidates from broker messages
fix(listings): flag conflicting total and unit prices
test(cli): verify JSONL output remains free of diagnostics
build(deps): pin the patched multer dependency
```

Use this guide during review. Commit hooks, commitlint, and automated releases are deferred until there is a concrete need for enforcement.
