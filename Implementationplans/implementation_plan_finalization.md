# Finalize Production Readiness & Documentation

## Goal
Make the repository fully functional, well-documented, and ready for use by other developers. This includes automated secret deployment, standardized CI/CD, and a premium README.

## User Review Required

> [!IMPORTANT]
> **Secret Deployment**: I will use the `gh` (GitHub CLI) to automate pushing your `.env` values to GitHub Repository Secrets. This will override existing secrets in the repo with the values currently in your `.env`.

> [!WARNING]
> **Legacy Cleanup**: I will delete `scripts/test-webhook.py` as it relies on an obsolete Cloudflare Queue architecture.

## Proposed Changes

### 1. Automation & Tooling

#### [NEW] [sync-secrets.ps1](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/scripts/sync-secrets.ps1)
A PowerShell script to parse `.env` and bulk-set GitHub Repository Secrets using the `gh` CLI. This handles multiline keys (like the Private Key) correctly.

---

### 2. GitHub Actions Infrastructure

#### [NEW] [action.yml](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/action.yml)
Metadata for the GitHub Action. This allows other repositories to use this repo as a native action: `uses: chirag127/github-actions-ai-auto-debugger@main`.

#### [MODIFY] [ci.yml](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/.github/workflows/ci.yml)
- Switch to `pnpm`.
- Add `pnpm run build` step.
- Enforce `continue-on-error: true` for **all** critical steps (lint, test, build).
- Add `type-check` step.

#### [MODIFY] [deploy.yml](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/.github/workflows/deploy.yml)
- Clarify that this workflow deploys the **Proxy Worker** to Cloudflare.
- Update secret names to match the new standardized names (e.g., `GH_APP_ID`).

---

### 3. Core Refinement

#### [MODIFY] [agent.js](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/src/agent.js)
Ensure consistent usage of environment variables and add robustness for "PR vs Direct Commit" detection.

---

### 4. Documentation (Comprehensive README)

#### [MODIFY] [README.md](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/README.md)
Complete rewrite with the following structure:
1. **Prerequisites**: Node.js, pnpm, GH App setup, LLM API keys, Cloudflare account.
2. **Installation**: Step-by-step `pnpm install`.
3. **Environment Setup**: Detailed variable table + `sync-secrets` script instructions.
4. **Database Migrations**: Explanation of the stateless architecture (no DB required).
5. **Running the App**:
   - Local development (manual trigger).
   - Production (Proxy Worker + Central Action).
6. **Running Tests**: Vitest commands.
7. **Deployment**: Step-by-step for Cloudflare Pages (Proxy) and GitHub Actions.
8. **Additional Tools**: `gh` CLI and `wrangler` usage.

---

### 5. Cleanup

#### [DELETE] [test-webhook.py](file:///c:/AM/GitHub/github-actions-ai-auto-debugger/scripts/test-webhook.py)
Obsolete script from the old queue-based architecture.

---

## Open Questions

- **Secret Handling**: Does the `.env` file contain **all** secrets currently needed? I will assume so based on our previous refactoring.
- **Workflow Names**: Should I standardize the monitoring workflow name to "CI" or allow a regex/list input in `action.yml`? (I will implement as a configurable input).

## Verification Plan

### Automated Tests
- `pnpm run lint`
- `pnpm test`
- `pnpm run build` (Ensures `dist/index.js` is updated).

### Manual Verification
- Verify `gh secret list` shows all synchronized keys.
- Inspect the generated `action.yml` for correctly mapped inputs.
- Read through the finalized README to ensure zero documentation gaps.
