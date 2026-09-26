# Orch8 plugin for Claude Code

Adds the following to Claude Code:

- **MCP server `orch8`**: your engine's `/api/v1/mcp` endpoint, with the tools `list_sequences`, `create_sequence`, `lint_sequence`, `preflight_sequence`, `create_instance`, `get_instance_status`, `get_instance_outputs`, `send_signal`, `retry_instance`, `list_dlq`, and `get_usage`.
- **Skills**
  - `author-sequence`: the sequence JSON contract and a lint → preflight → publish loop.
  - `run-locally`: `orch8 dev` usage (hot reload, `--skip-timers`, `--mock`, `--dry-run`, `--once`).
  - `deploy-release`: `orch8 sequence apply`, then `orch8 release create/diff/validate/canary/evaluate/promote/rollback`, plus `orch8 deploy --package` for signed packages.

When the plugin is enabled, Claude Code asks for three values: `orch8_url` (without `/api/v1`), `orch8_tenant_id`, and `orch8_api_key`. The key is marked `sensitive`, so it is stored in the OS credential store.

The skills call the `orch8` CLI. Make sure a current build is on `PATH`, since `orch8 dev`, `release`, and `deploy` are missing from old 0.1.x binaries.

## Install

This repository is its own plugin marketplace, so it is installable today straight from GitHub:

```bash
claude plugin marketplace add orch8-io/claude-code-plugin
claude plugin install orch8@orch8
```

Then run `/plugin configure orch8@orch8` in Claude Code (or pass `--config KEY=VALUE` to `install`) to set `orch8_url`, `orch8_tenant_id` and `orch8_api_key`.
Update later with `claude plugin marketplace update orch8`. Tagged versions are also on the [Releases](https://github.com/orch8-io/claude-code-plugin/releases) page.

## Try it from a local checkout

```bash
claude --plugin-dir ./claude-code-plugin
# or add this directory as a marketplace:
claude plugin marketplace add ./claude-code-plugin
claude plugin install orch8@orch8
```

## Validate

```bash
node scripts/validate.mjs                             # manifests, .mcp.json, SKILL.md frontmatter (no deps)
claude plugin validate .                              # marketplace manifest
claude plugin validate --strict .claude-plugin/plugin.json
```

CI runs all three on every push and PR to `main`. Pushing a tag `vX.Y.Z` (must equal `version` in `plugin.json`) creates a GitHub Release with a zip of the plugin.

Directory submission is described in [orch8-io/orch8-mcp `SUBMISSION.md`](https://github.com/orch8-io/orch8-mcp/blob/main/SUBMISSION.md).
