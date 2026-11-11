# Architecture

Margin is a single-user browser workspace backed by one local Node process. React and Vite provide the interface, Fastify provides a validated loopback API, Node's SQLite stores structured state, and content-addressed files retain originals and outputs. There is no hosted application dependency.

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
