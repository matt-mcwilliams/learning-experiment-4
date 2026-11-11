# Contributing to Margin

Start with [setup](README.md), [architecture](docs/architecture.md), and the repository's [agent instructions](AGENTS.md).

Keep changes tied to an actual learning workflow. Preserve learner effort, evidence-based judgments, source integrity, and local data ownership. Avoid engagement mechanics or required curriculum sequences. Make new capabilities explicit; do not silently introduce API billing, unbounded host execution, or cloud storage.

Before submitting a change:

```sh
npm run check
npm test
npm run build
npm run test:browser
npm run format:check
```

Run the opt-in live evaluation when changing the Codex adapter, protocol assumptions, source tools, or educational prompts. It uses the developer's ChatGPT plan and private temporary storage. Do not commit personal sources, credentials, live-evaluation transcripts, SQLite databases, or generated private learner work.

For a new activity or assessment type, include a realistic educational evaluation case and an end-to-end test. Preserve stored records or provide an explicit migration. Handle interruption, retries, and conflicting edits. Generated-tool execution must remain isolated and fail closed.

Report errors with sanitized reproduction steps and job IDs. Inspect quoted evidence before accepting an AI assessment as correct. Disagreement and uncertain evidence are expected parts of this product, not exceptions to conceal.
