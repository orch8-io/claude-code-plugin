---
name: author-sequence
description: Write or edit an Orch8 sequence (workflow JSON) and check it with lint and preflight before publishing. Use when the user asks to create, design, change, or fix an Orch8 workflow, sequence.json, or blocks such as step, router, parallel, loop, human_review.
---

# Author an Orch8 sequence

An Orch8 sequence is one JSON object. Produce JSON only (no comments, YAML, or pseudo-code), with snake_case fields exactly as below.

## Required top-level fields

| Field | Rule |
|---|---|
| `id` | New UUID for every published version |
| `tenant_id` | Owning tenant (the local `orch8 dev` session uses `default`) |
| `namespace` | Usually `default` |
| `name` | Stable name, e.g. `invoice-collection` |
| `version` | Integer; bump when behavior changes |
| `deprecated` | `false` for active versions |
| `blocks` | Non-empty array; every block `id` unique across the whole sequence |
| `created_at` | RFC 3339 timestamp |

Optional: `input_schema` (JSON Schema checked against `context.data` at instance create, 422 on mismatch), `sla` (`{"max_runtime": ms, "max_step_runtime": ms}`, alert only), `on_failure`, `on_cancel` (cleanup blocks).

## Blocks

Valid `type` values: `step`, `parallel`, `race`, `loop`, `for_each`, `router`, `try_catch`, `sub_sequence`, `ab_split`, `cancellation_scope`.

- `step`: `handler` plus `params`; optional `retry` (`max_attempts`, `initial_backoff`, `max_backoff`, `backoff_multiplier`), `timeout`, `delay`, `queue_name`, `wait_for_input`, `deadline`, `cache_key`.
- `router`: `routes[]` of `{condition, blocks}` plus `default`. Never invent `if`/`then`/`else`.
- `parallel` / `race`: `branches` is an array of block arrays.
- `loop`: `condition`, `body`, and always a practical `max_iterations` (default 1000, max 100000).
- `for_each`: `collection` (e.g. `context.data.items`), `item_var`, `body`, `max_iterations`.
- `try_catch`: `try_block`, `catch_block`, optional `finally_block`.

Durations are integer milliseconds. Per-run data goes in `context.data`, tenant configuration in `context.config`, and static handler settings in `params`. Templates look like `{{context.data.email}}`.

Built-in handlers include `noop`, `log`, `sleep`, `http_request`, `llm_call`, `tool_call`, `human_review`, `send_signal`, `query_instance`. Any other handler name needs an external worker, a plugin (`wasm://...`, `grpc://...`), or an installed integration, so tell the user which ones they must provide.

Human approval gate:

```json
{
  "type": "step",
  "id": "manager_approval",
  "handler": "human_review",
  "params": { "instructions": "Approve or reject this discount request" },
  "wait_for_input": {
    "prompt": "Approve discount?",
    "timeout": 3600000,
    "choices": [
      { "label": "Approve", "value": "approved" },
      { "label": "Reject", "value": "rejected" }
    ],
    "store_as": "discount_decision"
  }
}
```

The gate is answered with the signal `{"signal_type": {"custom": "human_input:manager_approval"}, "payload": {"value": "approved"}}` on `POST /api/v1/instances/{id}/signals`.

To start from a template, run `orch8 templates list`, then `orch8 templates show <name>`, or `orch8 init --template <name> <dir>`.

## Check before publishing

Repeat until clean:

1. If the `orch8` MCP server from this plugin is connected, call `lint_sequence` with the definition and fix every finding. Then call `preflight_sequence`.
2. Without MCP, run `orch8 sequence preflight --file sequence.json`. It exits non-zero unless the report is pass or warning.
3. Run it locally with the `run-locally` skill (`orch8 dev`).

Publish only after preflight passes, and only when the user asks: MCP `create_sequence`, or `orch8 sequence apply <file-or-dir>` (use `--dry-run` first; apply bumps the version only when the content changed). To ship a new version to live traffic safely, use the `deploy-release` skill.

The CLI reads `ORCH8_URL` (which includes `/api/v1`, e.g. `http://127.0.0.1:8080/api/v1`), `ORCH8_API_KEY`, and `ORCH8_TENANT_ID`.
