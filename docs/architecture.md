# Architecture

Margin is a single-user browser workspace backed by one local Node process. React and Vite provide the interface, Dockview provides persistent split panes and draggable tabs, Tiptap provides rich-text documents with Markdown storage, PDF.js renders the original PDF with annotation overlays, Fastify provides a validated loopback API, Node's SQLite stores structured state, and content-addressed files retain originals and outputs. There is no hosted application dependency.

## Ownership boundaries

- **The application owns truth:** sessions, plans, activities, source pages, annotations, drafts, immutable submissions, experiments, artifacts, knowledge evidence, recommendations, and task status.
- **Codex proposes content:** planning, instructional authoring, contextual tutoring, criteria-based critique, simulated expert questions, and synthesis each have their own typed response contract. No role can directly mutate the database, run learner code, or write arbitrary files.
- **The learner owns consequential learning actions:** selecting a topic, requesting material, submitting reasoning, requesting help, choosing experimental conditions, collecting observations, and interpreting evidence.
- **The runner owns execution:** generated or learner-authored Python only executes after an explicit run action, except for the disclosed apparatus startup test. An independent Linux sandbox receives only its code and structured inputs.

## Why app-server

The [official documentation](https://developers.openai.com/codex/app-server) describes the local, newline-delimited JSON-RPC protocol for threads, turns, streaming events, authentication, cancellation, and client-provided dynamic tools. This gives the product a real agent runtime while retaining control over state and interface. It also supports the user's existing ChatGPT Codex authentication without adding API billing. The app uses native Codex authentication rather than implementing its own OAuth token manager.

The integration was checked against Codex 0.167.1's generated protocol types as well as current official documentation. `dynamicTools` is experimental and explicitly negotiated during initialization. Each content task has a separate thread. Contextual tutoring resumes its previous successful thread; structured session context accompanies every task so a lost transcript does not erase the learning state. No multi-agent orchestrator is needed to obtain distinct reviewing perspectives; the defense contract requires independently grounded perspectives in one bounded task.

`server/codex.ts` owns JSON-RPC correlation, timeouts, failure propagation, tool handling, account checks, and cleanup. An isolated Codex home prevents inheriting user plugins, hooks, MCPs, skills, providers, or permissive execution settings. The model has only read-only source tools and optional built-in web search. Native execution and filesystem requests are denied.

### Explicit source tools

- `list_sources`: metadata, page count, and a short opening passage.
- `read_source`: up to twelve exact extracted pages in this session.
- `import_source`: retrieve and register a public source, subject to network and size checks.
- `read_run` and `read_submission`: inspect bounded slices of actual computational evidence and long-form submissions instead of inflating every prompt with the whole history.
- `read_artifact`: inspect an attached code, report, or data file as bounded text; binary files require a readable source.

Imported documents remain untrusted data. Structured references carry source IDs, physical pages or text-segment numbers, exact brief excerpts, and instructional purpose. The backend checks source ownership, page existence and quote matching before publication. Prompts insist on inspecting the body of papers and acknowledge extraction limits. This is a grounding mechanism, not a guarantee that every inference is correct.

## Persistent model

`server/store.ts` uses SQLite WAL transactions. A versioned record store holds typed records in separate indexed collections; it does not serialize an entire application's state into one chat blob. `shared/schema.ts` defines runtime contracts and frontend types. `PRAGMA user_version` is the migration version (currently 1). Add an explicit migration before changing stored contracts incompatibly; optional fields can be introduced without rewriting existing records.

Collections:

| Collection        | Records                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `sessions`        | Chosen objective, mode, time, plan, status, notes, current activity, synthesis                                |
| `activities`      | Ordered specification, explicit criteria, lazy material, editable draft/code, revisions, persistent lab state |
| `sources`         | SHA-256 original, provenance, URL, page-indexed extracted text, extraction limitations                        |
| `annotations`     | Exact selected passage, source page, learner note                                                             |
| `submissions`     | Immutable text/code snapshot, assistance disclosure, associated critique and defense                          |
| `runs`            | Actual execution, code, seed, settings, hypothesis, prediction, result, logs, runtime                         |
| `artifacts`       | Original attached or computed files, content hash, MIME metadata and size                                     |
| `jobs`            | Kind, status, user request, phase, failure, timestamps, native thread/turn IDs                                |
| `messages`        | Contextual learner/instructor exchanges                                                                       |
| `knowledge`       | Concept-level evidence linked to submissions, uncertainty, confidence, learner challenges                     |
| `recommendations` | Six per completion, rationale, category, objective, chosen follow-up                                          |
| `settings`        | Learning interests, recommendation goals, model and research preference                                       |

A partial unique index enforces one active session. Session creation atomically pauses the previous session. Draft saves use optimistic revisions; simultaneous stale edits receive a conflict. Session planning and completion use cross-record transactions. Interrupted tasks become retryable failures on startup rather than leaving an indefinite spinner. Blob names are hashes, never user-provided filesystem paths.

## Task lifecycle

1. Validate request and ownership; reject duplicate running tasks in the same session.
2. Persist a job before starting inference.
3. Build an appropriate role instruction plus current structured evidence. Interests/goals are added only for final recommendations.
4. Connect to app-server and verify ChatGPT authentication.
5. Publish coarse progress states while sources are read and the model works.
6. Require a successful completed turn and a schema-valid final message.
7. Verify references and, for a lab, run a technical apparatus smoke test and parse the analysis scaffold.
8. Publish content/state only after validation. Preserve completed work on failure or cancellation.

No partial streamed output is accepted as an assessment or a lesson. Retries retain the original request. The frontend polls only while a job is running. Failed tasks have actionable messages and inspectable IDs.

## Laboratory contract

An apparatus is inspectable standard-library Python plus an investigable question, model assumptions, independent/dependent variables, bounded controls, procedure, analysis starter, and limitations. It reads `config.json` and writes `result.json` with a `measurements` array. Downloadable files go in `output/`. The analysis editor receives `trials.json` containing real prior trial records. These inputs are supplied by the application, not copied by the learner.

Hypothesis and prediction are mandatory before a trial. The runner records actual output, including errors. A failed run remains a failed run. Identical seeds/configurations can be rerun, with code and runtime retained. The plotted measurements come directly from stored output. Model truth and synthetic observations must be labeled separately, and neither is presented as independent empirical validation.

A technical startup check tests the default configuration in a sandbox before publishing an apparatus. It never populates the learner's trial ledger. The analysis starter may intentionally contain TODOs: completing the statistical reasoning belongs to the learner.

## Extension points

Add an activity type by extending its runtime contract and view, then add a representative learning-quality evaluation. Add a runner through a capability interface with independent isolation tests; never allow a generated shell command onto the host. Add sources with provenance and precise location metadata. Add richer assessment evidence only when it can link to actual submissions or measurements.

Avoid introducing curricula, multi-user identity, vector databases, managed queues, or a fleet of agents until a specific learning workflow justifies them. The structured evidence remains useful without any of those systems.

## Reader and document workspace

Each session can store a serialized `workspaceLayout` with tab order, groups, active views, split direction and dimensions. It is cached immediately in the browser and autosaved to SQLite. The learner can drag tabs, split horizontally/vertically, resize panes, and close/reopen views. AI chat is a normal tab. Views retain their state while switching tabs; closed-book mode temporarily hides source, note and AI views and retains the prior layout. The sidebar identifies the current session, and its title leads the session brief. New layouts start with the brief, reading, work, PDF/sources, and AI chat; a laboratory view joins when needed. Review, notebook, and files remain available through Views, with review opening after submission. Existing saved layouts are preserved. Workspace actions share the tab strip. On narrow screens, an explicit current-view selector replaces clipped tabs. Secondary writing actions live under More actions; Python remains a separate work format. Creating or restoring a split enters a reversible focus state by collapsing navigation once. Format reveals the writing toolbar; assignment criteria and the closed-book action share a disclosure. Source selection and PDF controls share one header, with imports under Sources.

Prose uses a Tiptap document with toolbar formatting, a live word count, and editable inline/block mathematics. Existing Markdown drafts load without migration and new drafts continue to serialize to Markdown. Python remains in CodeMirror. Rich document serialization is exercised through save/reload tests rather than assumed from appearance.

The PDF viewer draws the original page using a locally hosted PDF.js worker, fonts, character maps and image decoder modules. The `wasmUrl` path is required even with WebAssembly disabled: PDF.js loads its JavaScript JBIG2/CCITT and JPEG 2000 decoders from that directory. These modules run under the existing CSP without enabling dynamic evaluation. Scanned pages can otherwise appear blank while their independent OCR text layer remains selectable.

Pages form one continuous scroll, with dimensions taken from the document (including mixed page sizes). Intersection observers mount nearby canvases and text layers; distant pages retain dimensioned placeholders. The visible page drives the toolbar and persistent reader page, while a per-source browser cache retains fractional scroll position and zoom. Navigation jumps within the scroll; zoom and pane resizing preserve position. Selection rectangles and sticky-note anchors use normalized page coordinates, so overlays survive resizing and zoom. Each pending selection/note retains its own page number, even if the learner scrolls before saving. Existing textual annotations remain visible in the annotation list. PDF.js and Poppler can order text or handle ligatures differently: user-authored PDF selections with geometric anchors are stored as annotations, while AI source quotations still require source-text verification. Notes and highlights can be edited and deleted within their owning session.

Reading activities embed page-linked source passages. The `excerpts` job uses the existing ChatGPT-authenticated Codex adapter for paragraph layout and passage selection. Every returned block must be a contiguous source substring after Unicode normalization, physical-line-wrap cleanup and line-break dehyphenation. The formatter cannot paraphrase or add invented headings. Remote quotation limits remain enforced. Equation text is preserved verbatim; the original PDF remains authoritative for complex notation. New PDF-based materials request formatted excerpts automatically; existing activities have a Format source excerpts action. If automatic formatting fails, the lesson remains available with its original source and a formatting retry action. No failed formatted passage is published.
