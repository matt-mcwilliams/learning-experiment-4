# Margin

**A quiet place for difficult ideas.**

Margin is an open-source, local-first learning and research workspace. Work through a paper, derive a mathematical result, run a reproducible investigation, or build something and defend it. The unit of learning is an independent session, not a course or a chat thread.

It uses a local **Codex app-server with your ChatGPT sign-in**. There is no OpenAI API-key integration, cloud database, telemetry service, or separate inference billing configured by this application. Your subscription's access policies and usage limits still apply. Inference and web research require an internet connection; saved work can be read and edited offline while the local server is running.

![Margin learning workspace](docs/images/margin.png)

## Run it on Linux

Requirements:

- Node.js **24 or newer**, npm, and the [official Codex CLI](https://developers.openai.com/codex/cli).
- Python 3, **bubblewrap 0.8 or newer**, **Poppler** (`pdftotext`, `pdfinfo`), and util-linux (`prlimit`).
- Unprivileged Linux user namespaces. Code execution and PDF parsing fail closed when isolation cannot start.

On Arch Linux:

```sh
sudo pacman -S python bubblewrap poppler util-linux
```

On Debian/Ubuntu:

```sh
sudo apt install python3 bubblewrap poppler-utils util-linux
```

On Ubuntu 24.04, AppArmor may require the distribution-provided `bwrap-userns-restrict` profile before unprivileged sandboxing works. Run the setup check first; Margin does not modify system security policy or disable isolation. Older distributions must provide bubblewrap 0.8+ for nested-namespace restrictions.

Install the Codex CLI if needed, then sign in with **ChatGPT**:

```sh
npm install -g @openai/codex
codex login
```

From this repository:

```sh
npm ci
npm run setup
npm run build
npm start
```

Open **http://127.0.0.1:4317**. For development, run `npm run dev` and open **http://127.0.0.1:4318**. The API remains on port 4317; development requests are proxied from 4318.

`npm run setup` checks the installed programs, sandbox, authentication, and model catalog. A model appearing in the catalog does not establish entitlement; an inference turn verifies access. The tested Codex version is **0.167.1**. The app-server's dynamic source-tool interface is experimental, so upgrading Codex should be followed by the live evaluation.

### Authentication details

Margin creates an isolated Codex home under its private data directory. If your existing Codex sign-in uses `auth.json`, Margin reuses it through a symlink without reading token values. Codex manages refresh. Your global plugins, hooks, MCP servers, execution rules, and model providers are not inherited.

Keyring-only installations may require a separate ChatGPT sign-in for this isolated home. `npm run setup` prints the exact command. For the default data path:

```sh
CODEX_HOME="$HOME/.local/share/margin/codex" codex login
```

The adapter checks for a ChatGPT account **before starting any inference turn** and rejects API-key accounts. Credentials never reach the frontend or session exports. See the [official authentication documentation](https://developers.openai.com/codex/auth) and [app-server documentation](https://developers.openai.com/codex/app-server).

## A session, end to end

1. **Bring a question.** Choose paper study, concept study, investigation, or original work. Set an approximate 1–10 hour budget. Attach a PDF, Markdown/text document, or public source URL if you have one. If you want topic suggestions, ask for them in the session objective; you can also start any saved recommendation.
2. **Inspect the brief.** Codex researches and proposes objectives, prerequisites, activities, and explicit assessment criteria. Prerequisites are advice. Edit activity titles and purposes when useful. Starting a new session pauses the previous one; its work is preserved.
3. **Approach one activity.** Materials are generated only when you request them. The instructor sees the actual source pages, previous submissions, questions, annotations, and experimental records.
4. **Read and work.** Read source excerpts directly inside an activity, with AI paragraph formatting checked against the original page text. Use the original PDF reader for highlighting and sticky notes, including editing, deletion, page navigation, and zoom. Write in a document-style editor with a formatting toolbar, live word counter, and editable equations; Markdown remains the storage format. Retrieval activities offer an honor-based closed-book workspace. Hints are progressive; written work remains yours.
5. **Investigate when it helps.** A generated laboratory provides an executable apparatus, variables, controls, assumptions, and a procedure. State a hypothesis and prediction, choose controls and seed, and collect one trial at a time. Measurements, code, settings, Python version, console output, and output artifacts survive restarts. Compare trials, plot numeric columns, export CSV, and complete your own Python analysis.
6. **Submit and defend.** Each submission is an immutable revision of your response and code. Critiques use explicit criteria and preserve their evidence. A simulated panel asks questions from different perspectives. Write a defense or revision and submit it again. Attach reports and code; readable PDF/text reports also become inspectable sources.
7. **Conclude with evidence.** Margin distinguishes demonstrated work, uncertainty, and untested retention. It saves exactly six varied future-session recommendations. Your interests and long-term goals affect these recommendations, never the content of your chosen session.

The workspace uses draggable tabs across the top, including **AI chat**. Drag a tab to an edge to split the workspace, or use **Split right** / **Split below**. Resize panes by dragging their dividers, close/reopen tabs, or reset the layout. Your layout is saved per session and restored on restart. On narrow screens, use the current-view selector. Use **Views** to open the notebook, review, files, or another view.

PDFs scroll continuously between pages. The toolbar tracks your current page; page numbers and arrows jump within the document. Your reading position and zoom are remembered in this browser. Only nearby pages are painted to limit memory use. Scanned papers use locally served image decoders, so the page image and its selectable text layer both render.

There are no streaks, badges, numerical mastery scores, or mandatory curriculum gates. Knowledge judgments can be challenged. Saved recommendations stay available even when you choose something else.

## Data ownership and recovery

Private data defaults to:

```text
${XDG_DATA_HOME:-$HOME/.local/share}/margin/
  margin.sqlite       # session records, plans, drafts, assessments, jobs, lab state
  blobs/              # original documents and artifacts, addressed by SHA-256
  codex/              # private Codex configuration, native thread history, auth link
  agent-workspace/    # empty working root; the educational agent has no shell tools
```

The data directory is created with owner-only permissions. It is **not inside this Git repository**. Individual session JSON exports contain the structured work; original sources and artifacts have separate download links. Exports contain your private work and should be handled accordingly.

For a complete backup, **stop Margin**, then copy `margin.sqlite` and `blobs/` together to a private backup directory. Restore both to the data directory while Margin is stopped. Reconnect Codex separately; do not distribute credentials or authentication links. Session correctness does not depend on Codex thread history: the structured context can reconstruct a task. Browser recovery copies protect recent unsaved drafts; stale concurrent edits produce a conflict instead of silently overwriting a draft.

Interrupted AI tasks become visible, retryable failures on restart. Cancellation never discards completed work. The Files view exposes task IDs and thread/turn diagnostics without requiring raw logs during learning.

Configuration uses environment variables:

| Variable                   | Purpose                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `MARGIN_DATA_DIR`          | Override the private data directory                                |
| `MARGIN_PORT`              | API/production port, default `4317`; dev UI uses the next port     |
| `MARGIN_CODEX_BIN`         | Path to an official Codex executable                               |
| `MARGIN_NATIVE_CODEX_HOME` | Native Codex home containing the existing `auth.json`              |
| `MARGIN_CHROMIUM`          | Chromium executable for browser tests, default `/usr/bin/chromium` |

## Capability boundaries

| Capability                                  | Implementation and limit                                                                                                                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI instruction, critique, defense, planning | Official local Codex app-server, ChatGPT-authenticated; structured outputs validated with Zod                                                                                                                               |
| Research                                    | Codex web search when enabled and available under account policy; public URL ingestion with validated/pinned DNS and redirect checks                                                                                        |
| Papers                                      | PDF.js page rendering with anchored highlights/sticky notes; sandboxed Poppler extraction, source-checked AI excerpt formatting and physical page references; 20 MB/source, first 400 pages, 2 million extracted characters |
| Quotations                                  | Exact normalized substring checks before publication; brief remote excerpts capped at 25 words per source per response; no invented quotations accepted                                                                     |
| Mathematical work                           | Document-style rich text (Tiptap), live word count, editable KaTeX equations, Markdown storage; CodeMirror for Python                                                                                                       |
| Computation                                 | Linux bubblewrap + standard-library Python; no home, credentials, privileged operations, or network access                                                                                                                  |
| Lab outputs                                 | Synthetic/simulated data explicitly labeled; they do not independently validate the simulator's assumptions                                                                                                                 |
| Projects                                    | Editable Python, executed runs, attached files, reports, immutable submissions and interactive simulated defenses                                                                                                           |
| Images and lectures                         | Links to external originals and generated numeric plots; no assumed hosted image-generation, video-transcription or Code Interpreter access                                                                                 |

Python runs have 8 CPU seconds, 15 wall seconds, 768 MB address space, bounded output, file limits, a monitored working-directory budget, and a 32 MB temporary filesystem. Two computations can run at once. Generated symlinks are not followed when collecting artifacts. A technical startup check validates each generated apparatus; its measurements are deliberately excluded from the learner's ledger. Failed generated apparatuses are not published.

The app is intended for a trusted person on a **loopback-only server**. It checks Host/Origin and requires a client header for writes. Do not expose it to a network as a multi-user service. Uploaded documents are still sent to OpenAI as context when you request AI work; “local-first” describes ownership and persistence, not local model inference. Remote source retrieval contacts the source's host.

Known limitations are explicit: there is no OCR, visual figure interpretation, full terminal/IDE, arbitrary package installation, multi-language code execution, physical-device integration, automatic video timestamp validation, or direct hand-written mathematics recognition. Inspect original PDFs when extraction loses equations or figures. Binary artifacts require a readable companion report for review. Closed-book controls support learning discipline, not proctoring. AI judgments remain fallible; inspect their evidence and challenge them.

## Development and verification

```sh
npm run check         # TypeScript
npm test              # persistence, lifecycle, grounding, sandbox, HTTP and protocol tests
npm run build         # type check + production frontend
npm run test:browser  # actual Chromium -> API -> SQLite -> rendered response
npm run test:live     # opt-in paper + lab evaluation; consumes subscription usage
npm run test:live:project # opt-in code review, defense, native thread resume + lab check
npm run test:live:excerpts # opt-in actual LLM typesetting and verbatim source validation
npm run format:check  # formatting
```

Browser tests require Chromium at `MARGIN_CHROMIUM` or `/usr/bin/chromium`. They launch a separate, explicitly labeled fixture agent through a test-only server and a disposable database. Production never substitutes fixture responses for failed inference. The live evaluation retrieves an actual paper and exercises plan → source-grounded teaching → critique of false reasoning → defense → contextual help → completion and six recommendations, then generates and executes a reproducible laboratory. Its private outputs go to a temporary directory. See [verification notes](docs/verification.md) for evidence and educational-quality limits.

See [architecture](docs/architecture.md), [security](docs/security.md), and [contributing](CONTRIBUTING.md) to extend the system.

## License

[MIT](LICENSE) © 2026 Matthew McWilliams. Font and mathematical typesetting assets retain their respective open-source licenses; see [third-party notices](docs/third-party-notices.md).
