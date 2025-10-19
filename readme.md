# PRereq

**Cross-repo PR dependency gating for GitHub.**
Block merges until declared prerequisite PRs in other repositories are merged — org-wide, with zero per-repo setup.

## Features

⚙️ Automatic enforcement — no manual configuration per repo.

🔁 Real-time re-evaluation — when a dependency merges, dependents recheck automatically.

🧩 Graph persistence — relationships stored in Postgres via Drizzle ORM.

🛡️ Cycle detection — prevents circular references (A → B → C → A).

🚫 Bypass support — add label deps:skip to opt out.

🌐 Cross-org support — works across repositories where the app is installed.

💬 Intent keywords — configurable in future releases.

## How it works

- Reference dependencies in PRs using native GitHub syntax:
    - `org/repo#123`
    - `repo#456` (same org)
    - `#789` (same repo, optional)
- PRereq picks up dependencies that follow these prefixes:
    - `depends on`
    - `blocked by`
    - `requires`
    - `needs`
    - `prerequisite`
    - _Your own intent keywords_
- PRereq creates a required **Check Run** named `cross-repo-deps`.
- The check **fails** until all referenced dependency PRs are **merged**.
- When a dependency PR merges, PRereq automatically re-evaluates dependents and unblocks them.

## Example

PR A (repo-a) body:
Implements API surface for Foo.

Blocked by `org/repo-b#123` (schema PR) — requires that to merge first.

PRereq detects:

- intent: `blocked by`
- dependency: `org/repo-b#123`
- result: `cross-repo-deps` fails until repo-b#123 is merged.

PRereq then:

- Provides a sticky PR comment
- Blocks merging

## Installation

1. Create a GitHub App at [GitHub Developer Settings → GitHub Apps](https://github.com/settings/apps):
    - Permissions → Repository:
        - Read & write: Checks
        - Read: Pull requests, Issues, Contents
    - Events: pull_request, issues
    - Webhook secret → copy to .env
2. Install the App on your org (recommended: all repositories).
3. Add `cross-repo-deps` as a **required** status check in your branch protection rules.
4. Provide environment variables. Refer to [`.env.example`](.env.example).

## Local Development

### Requirements

- Node 22+
- pnpm
- Postgres 14+

### Setup

```shell
git clone https://github.com/g30r93g/prereq
cd prereq
cp .env.example .env
# fill values

pnpm install
pnpm db:generate && pnpm db:migrate
pnpm dev
```

Use a tunnel provided by [`smee.io`](https://smee.io/) to expose port 3000 to GitHub’s webhook.

### Docker

docker-compose.yml is included for one-command startup:

```shell
docker compose up --build
```

This runs:

- Postgres (with persistent volume)
- PRereq app (auto-migrates DB and starts server)

## Database Schema

PRereq stores dependency relationships in Postgres:

| Column group | Meaning                         |
| ------------ | ------------------------------- |
| `dependent*` | PR that’s **blocked** by others |
| `dep*`       | PR that must merge **first**    |

Each row = one directional edge in the dependency graph.

Example:

```
frontend#42 → backend#17
```

Means “frontend#42 depends on backend#17”.

## Circular Reference Protection

PRereq prevents infinite evaluation loops:

- Detects cycles (`A#1 → B#2 → A#1`) via DFS.
- Fails with a descriptive check output.
- Debounces re-evaluations to prevent webhook storms.

## Future Roadmap

- ✅ GitHub App marketplace listing
- 🔧 Custom intent keywords via `.prereq.yml`
- 💬 Sticky comment updates with real-time dependency graph
- 📊 Dashboard to visualize cross-repo dependency graphs

## License

PRereq is released under the Business Source License 1.1.

Use is permitted for non-commercial purposes only.
Any **commercial, hosted, or derivative** use — including reproduction,
distribution, or modification — requires the **express written consent**
and a **commercial license** from the author.

Refer to the [LICENSE](./LICENSE) file for the complete terms.
