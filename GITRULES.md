# Git Rules

Rules for how this project uses Git. Follow these conventions on every commit, branch, and merge.

## Branching (Adapted Git Flow)

- **`main`** — protected, stable, always deployable. Never commit directly to it.
- **`ceo-development`** — long-lived working branch owned by the CEO for day-to-day work (content, docs, experiments, integration testing). Base for CEO work. Keep it in sync with `main` via `git pull --rebase`, and merge it into `main` via a PR when ready.
- **`feature/<name>`** (e.g. `feature/auth`) — short-lived branches for task-level development. Cut from `main`, merged via PR (squash). No long-lived feature branches.
- **`fix/<name>`**, **`chore/<name>`**, **`docs/<name>`** — for bug fixes, maintenance, and documentation work, as needed.
- Only the CEO (or designated maintainers) merge into `ceo-development`. All merges into `main` require code review.

## Commit Convention (Conventional Commits)

Use the Conventional Commits format:

```
<type>: <imperative subject>
```

- **Subject** — lowercase, imperative mood, max 72 characters, no trailing period. Example: `feat: add user authentication`.
- **Types** — `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `perf:`, `test:`, `style:`.
- **Body** — add a blank line after the subject; use bullet points to explain the *why* when it is not obvious.
- No emojis in commit subjects.

## Commit Hygiene

- Commit atomically: one logical change per commit.
- Review what you stage before committing; do not blindly `git add -A`.
- Never commit secrets. Only `.env.example` is tracked, never a real `.env` file.
- Do not commit files listed in `.gitignore` (currently `setup.sh`, `TODO.md`).
- Write for the future reader: a commit message should explain the change to someone reading history, not just to yourself.

## History & Sync

- Prefer `git pull --rebase` when updating long-lived branches (`main`, `ceo-development`).
- Squash-merge PRs into `main` to keep history clean.
- No force-pushing to shared branches (`main`, `ceo-development`, any `origin/*` branch).

## Tagging

- Tag releases with semantic versioning: `vX.Y.Z` (e.g. `v0.1.0`).

## Before You Commit

- Run the relevant tests, linter, and typecheck for your change.
- For work targeting `main`, confirm your branch is up to date with `main` first.