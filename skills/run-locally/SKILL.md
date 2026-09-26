---
name: run-locally
description: Run an Orch8 sequence on the developer's machine with `orch8 dev` (hot reload, local API and dashboard, virtual time, handler mocks). Use when the user wants to try, debug, smoke-test, or iterate on a workflow locally before publishing.
---

# Run a sequence locally with `orch8 dev`

`orch8 dev` needs no database or running engine. By default it starts a local HTTP API, a persistent SQLite store, and the dashboard, then runs the sequence and hot-reloads it on every save. Sequences and instances run under the tenant `default`.

If `orch8 dev --help` reports an unknown subcommand, the installed CLI is too old. Install the current CLI with the project's `install.sh` or build it from the engine repository.

## Common invocations

```bash
# Scaffold a project (config, example sequence.json, docker-compose)
orch8 init my-flow && cd my-flow

# Run ./sequence.json with hot reload, API at http://localhost:8080/api/v1,
# dashboard at http://localhost:8080/, Swagger at /swagger-ui
orch8 dev

# Pass the initial context.data
orch8 dev --input '{"email":"ada@example.com","plan":"trial"}'

# Skip real waits: delays, send windows, and retry backoff fast-forward on a virtual clock
orch8 dev --skip-timers

# Stub a handler that has no worker yet (repeatable)
orch8 dev --mock send_email='{"sent":true}' --mock order_charge='{"charge_id":"ch_test"}'

# Dry run: side-effecting built-ins return stubs and human gates auto-approve
orch8 dev --dry-run

# CI smoke test: run one instance to a terminal state; exit 0 if completed, 1 if failed
orch8 dev --once --no-server --skip-timers --input '{"name":"ci"}'

# Watch a whole directory of workflow JSON files and start an instance after each reload
orch8 dev --workflows ./workflows --auto-run

# Other flags: --sequence <file>, --port <n> (default 8080), --tick-ms <n>
```

`[path]` may be a directory containing `sequence.json` or the sequence file itself.

## Working loop

1. Make sure the sequence passes lint/preflight (see the `author-sequence` skill).
2. Start `orch8 dev` in the background with `--skip-timers`, and add `--mock` for every handler that no worker serves yet.
3. Read the per-step output previews it prints. After 5 seconds without progress it prints a stall hint, which usually means a missing worker, an unanswered human gate, or a long delay.
4. Answer a human gate against the local API:
   `curl -X POST http://localhost:8080/api/v1/instances/<id>/signals -H 'content-type: application/json' -H 'x-tenant-id: default' -d '{"signal_type":{"custom":"human_input:<block_id>"},"payload":{"value":"approved"}}'`
5. Edit the file. The dev loop reloads it and, with `--auto-run`, starts a fresh instance.

Before publishing, finish with `orch8 dev --once --no-server --skip-timers` so there is a deterministic pass or fail.
