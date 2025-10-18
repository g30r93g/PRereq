# PRereq

**Cross-repo PR dependency gating for GitHub.**  
Block merges until declared prerequisite PRs in other repositories are merged — org-wide, with zero per-repo setup.

---

## How it works

- Authors reference dependencies using native GitHub syntax in **title or body**:
  - `org/repo#123`
  - `repo#456` (same org)
  - `#789` (same repo, optional)
- If text also contains intent keywords near those references, PRereq **enforces**:
  - `depends on`
  - `blocked by`
  - `requires`
  - `needs`
  - `prerequisite`
  - _Your own intent keywords_
- PRereq creates a required **Check Run** named `cross-repo-deps`.
- The check **fails** until all referenced dependency PRs are **merged**.
- When a dependency PR merges, PRereq automatically re-evaluates dependents and unblocks them.

---

## Example

PR A (repo-a) body:
Implements API surface for Foo.

Blocked by org/repo-b#123 (schema PR) — requires that to merge first.

PRereq detects:

- intent: `blocked by`
- dependency: `org/repo-b#123`
- result: `cross-repo-deps` fails until repo-b#123 is merged.

PRereq then:

- Provides a sticky PR comment
- Blocks merging

---

## Install

1. **Create a GitHub App**
   - _GitHub → Settings → Developer settings → GitHub Apps → New GitHub App_
   - Webhook URL: your deployment URL (for local dev, see below)
   - Webhook secret: generate and save
   - Permissions (Repository):
     - **Checks: Read & write**
     - **Pull requests: Read**
     - **Issues: Read**
     - **Contents: Read**
     - Metadata: Read (implicit)
   - Subscribe to events:
     - `pull_request` (opened, edited, synchronize, reopened, ready_for_review, closed)
     - `issues` (edited)
     - (optional) `pull_request_review` (submitted)
   - Generate a private key (`.pem`)
   - Install the App on your **organization** (all repos or selected)

2. **Configure branch protection**
   - In your org ruleset or per-repo branch protection, **require status check**:
     - `cross-repo-deps`

---
