# Project instructions

This codebase is yours: what it's for and how it's built are your call, and you'll keep building on it.

## Project context

- Repository: `matt-mcwilliams/learning-experiment-4`.
- Public, open source project licensed under MIT; see `LICENSE`.
- Initialized from an empty directory. No application, language, framework, dependencies, or build system has been selected yet.
- Add accurate architecture, setup, build, and test instructions as the project develops.

## Verification

- No application build or test commands exist yet. Do not claim application tests have passed.
- Run `git diff --check` before staging to check patch whitespace.
- Run `git diff --cached --check` and inspect `git diff --cached` before committing.
- Run `git status --short --branch` after committing and pushing to verify the worktree and upstream state.
- When introducing a build or test system, run its commands and record verified commands here.

## Commit and push rules

- After each completed change, run appropriate checks, commit only the files changed for that task, and push to the configured GitHub upstream without waiting for a separate request.
- Before editing, record staged, unstaged, and untracked files. Files with pre-existing changes are off limits: do not edit, stage, commit, revert, stash, or otherwise alter them unless the user explicitly authorizes those files. Ask if the task depends on such a file.
- Stage explicit paths only; never use `git add .`, `git add -A`, or other blanket staging.
- Inspect the staged diff and commit contents. Preserve unrelated staged changes and use a path-scoped commit when needed to exclude them.
- Never force-push or rewrite existing commits. If a push would include unrelated unpushed commits, ask before publishing those commits.
- Outside `/init`, report a missing repository, GitHub remote, upstream, or authentication as a blocker rather than guessing or creating a destination.
- Report the commit and push result, including any failure, in the final response.
