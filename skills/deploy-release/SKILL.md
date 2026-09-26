---
name: deploy-release
description: Publish an Orch8 sequence to a real engine and roll a new version out safely with releases (diff, historical replay validation, canary, gated promotion, rollback) or a signed package deploy. Use when the user asks to deploy, publish, release, canary, promote, or roll back an Orch8 workflow.
---

# Deploy and release an Orch8 sequence

Point the CLI at the target engine first (the URL includes `/api/v1`):

```bash
export ORCH8_URL=https://orch8.example.com/api/v1
export ORCH8_API_KEY=...        # never echo or commit it
export ORCH8_TENANT_ID=acme
orch8 health
```

Confirm the target environment with the user before any write. Every command below changes a live engine except `diff`, `get`, `list`, `decisions`, and `--dry-run`.

## 1. Readiness and publish

```bash
orch8 sequence preflight --file sequence.json     # non-zero exit unless pass or warning
orch8 sequence apply sequence.json --dry-run      # show what would change
orch8 sequence apply sequence.json                # upload a new version only if the content changed
orch8 sequence versions <tenant> <namespace> <name>
```

`apply` accepts a file or a directory of `.json` files and is idempotent, so it is the GitOps path to use in CI. A first version with no traffic to protect can stop here.

## 2. Guarded release of a new version

Pick the current version (baseline) and the newly applied version (candidate) from `orch8 sequence versions`:

```bash
RELEASE_ID=$(orch8 --output json release create --tenant-id "$ORCH8_TENANT_ID" \
  --baseline "$BASELINE_ID" --candidate "$CANDIDATE_ID" \
  --max-error-regression 0.05 --min-sample 20 | jq -r '.id')

orch8 release diff "$RELEASE_ID"                  # side-effect and compatibility risk
orch8 release validate "$RELEASE_ID" --sample 20  # effect-free replay of recorded baseline runs
orch8 release canary "$RELEASE_ID" --percent 10   # deterministic cohort of NEW instances
orch8 release evaluate "$RELEASE_ID"              # a failing gate rolls back automatically
orch8 release promote "$RELEASE_ID"               # rejected until every gate passes
orch8 release decisions "$RELEASE_ID"             # immutable audit trail
```

- Gates stay inconclusive until both variants reach `--min-sample`, and inconclusive never counts as a pass. Keep evaluating; don't `--force` unless the user explicitly accepts the risk.
- `orch8 release pause <id>` sends traffic back to the baseline and can be resumed with `canary`. `orch8 release rollback <id>` is permanent and idempotent.
- For CI, use `orch8 release gate <id> [--sample N] [--max-divergences 0] [--max-inconclusive 0] [--allow-side-effect-risk]`, which exits non-zero when the proof gate fails.
- Releases never migrate in-flight instances. To move one deliberately, use `orch8 sequence migrate-instance <instance_id> <target_sequence_id>`.

## 3. Signed package deploy (optional)

When the organization ships signed `.orch8pkg` bundles:

```bash
orch8 package keygen                                # once; store the seed as a secret
orch8 package build ./pkg --key @publisher.seed     # dir with package.json and sequences/
orch8 package verify <file>.orch8pkg --trusted-key <base64-pubkey>
orch8 deploy --package <file>.orch8pkg --release-id "$RELEASE_ID" \
  --canary-percent 5 --observations 3 --promote
```

`orch8 deploy` verifies the package signature, runs the release gate, starts the canary, evaluates `--observations` times, and promotes only with `--promote` when every gate passes.

## After deploy

Check new instances with `orch8 instance list` and the dashboard. If failures spike, run `orch8 release rollback "$RELEASE_ID"` and inspect the DLQ (the MCP `list_dlq` tool, or `GET /api/v1/instances/dlq`).
