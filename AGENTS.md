# Project instructions

This codebase is yours: what it's for and how it's built are your call, and you'll keep building on it.

## Project context

- Repository: `matt-mcwilliams/learning-experiment-4`.
- Public, open source project licensed under MIT; see `LICENSE`.
- Product: Margin, a local-first single-user learning and research workspace.
- Stack: TypeScript, React/Vite, Dockview, Tiptap, PDF.js/react-pdf, Fastify, Node SQLite, and official Codex app-server authenticated with ChatGPT. Python executes only in bubblewrap.
- Read `README.md` and `docs/architecture.md` for setup, data boundaries, and extension points.
- Source modules: `server/` (API, persistence, sources, agent, runner), `shared/schema.ts` (runtime contracts), `src/` (workspace), `tests/` and `scripts/live-eval.ts` (verification).
- Add accurate architecture, setup, build, and test instructions as the project develops.

## Verification

- Verified commands: `npm run check`, `npm test`, `npm run build`, `npm run test:browser`, and `npm run format:check`.
- `npm run test:live` is opt-in real Codex inference and consumes ChatGPT subscription usage. Run it for protocol/prompt changes; keep outputs private and outside the repository.
- `npm run setup` diagnoses Node, Codex authentication, Python, Poppler and sandbox availability. `npm run dev` serves the UI on 127.0.0.1:4318; production uses `npm run build` then `npm start` on 127.0.0.1:4317.
- Browser checks use system Chromium (override with `MARGIN_CHROMIUM`). Fixture inference is allowed only through test entry points. Never add fixture fallback to production.
- Core tests must actually exercise sandbox execution on supported Linux machines. A skip means that capability has not been verified there.
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

## Product and safety invariants

- One active session; no required curriculum or prerequisite gates. Long-term goals enter recommendations only.
- Preserve sources, learner work, immutable submission revisions, actual run output, seeds, uncertainty, and supporting evidence.
- Generate individual materials lazily. Exactly six distinct recommendations are saved at completion.
- No API-key billing, inherited user plugins/MCPs, arbitrary host execution, or unisolated fallback. Do not read or print credential values.
- Private state belongs in the data directory, outside Git. Never commit documents, transcripts, backups, SQLite files, or authentication links.
- Documents and generated code are untrusted data. Source quotations must match actual pages. Label simulations as synthetic; apparatus startup tests do not count as learner observations.

- PDF annotation geometry uses normalized page coordinates; keep overlays aligned through zoom and resize. Preserve older textual annotations.
- PDF regressions must verify painted page content, not only canvas existence or selectable text. Keep image decoder assets available even when WebAssembly is disabled, and keep continuous scrolling from mounting every canvas.
- Rich prose round-trips through Markdown, including math nodes. Python editing remains separate. Test actual saved content, not only editor appearance.
- Formatted source excerpts must pass verbatim validation after physical line-wrap normalization; never replace source words with an LLM paraphrase. `npm run test:live:excerpts` verifies the real formatter.
