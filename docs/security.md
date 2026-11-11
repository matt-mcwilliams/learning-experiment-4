# Security and privacy

Margin is for a trusted user running a loopback-only application. It is not a hardened public service or a substitute for a disposable VM when executing deliberately hostile code.

## Model access

The local Codex app-server is authenticated through Codex. Margin never reads credential values and never sends them to its frontend. It rejects API-key accounts before inference. The isolated Codex home disables shell tools, unified execution, plugins, apps, subagents, memories, browser/computer control, and skill discovery. Source tools validate ownership and arguments. Unrecognized server requests, including execution and permission escalation, are rejected. The app-server workspace is separate from the repository and personal files.

Sources and submissions are untrusted context, not authorization. Role instructions explicitly tell the model to disregard instructions found inside them. This prompt defense complements capability restrictions: even a deceived model cannot ask Margin to execute a shell command or modify unrelated files. Model-generated Python is a data artifact until the user explicitly runs it (or the application performs its isolated technical startup check).

## Computation and parsing

Bubblewrap unshares user, PID, network and other namespaces, drops capabilities, disables nested user namespaces, remounts the root read-only, and exposes only system binaries/libraries (`/usr`, `/lib`, `/lib64`) read-only plus a disposable working directory. The user's home, credentials, application database, private blobs and project are not mounted. Environment variables are cleared. Python runs in isolated mode and applies hard CPU, address-space, file-size, process and descriptor limits. The parent enforces a wall deadline and aggregate console-output cap, monitors working-directory disk use, and kills the process group when limits are exceeded. `/tmp` has a fixed-size tmpfs.

Output collection does not follow generated symlinks, including a replaced output directory or result file. Only bounded regular files are retained. Executable HTML/SVG attachments are downloaded as binary with `nosniff`, not run in the product origin. A corrupt or failing run keeps its actual error output; fabricated replacement measurements are never supplied.

PDFs are parsed in the same isolated mount environment with `prlimit` CPU/address-space/descriptor limits and a parent timeout/output cap. Only text-layer PDFs are supported. User uploads have a 20 MB cap and hash-based storage names.

These are reasonable single-user safeguards, not a claim of formal sandbox verification. Linux kernel vulnerabilities, host disk pressure between monitoring intervals, and privileged-user interference are outside the threat model. Do not expose the runner as an untrusted multi-user service.

## Retrieval and browser boundary

Public URL ingestion permits only HTTP(S) on standard ports, without URL credentials. It resolves and rejects private, loopback, link-local, reserved and mapped private addresses. The outbound connection is pinned to the validated DNS answers. Each redirect is checked again. Fetches have size/deadline limits. There is no paywall or authentication bypass.

The server binds to `127.0.0.1`. API requests check Host and Origin; write operations require an application-specific header, preventing ordinary cross-site forms from changing state. There is no permissive CORS policy. Responses disable caching for private API data. CSP limits scripts, connections, fonts, frames and images to local assets, with no raw model HTML or arbitrary remote images rendered. Markdown is rendered without a raw-HTML plugin; KaTeX runs with `trust: false` and a patched version shared by its Markdown dependencies.

## Private storage

The data directory has mode 0700. Credentials remain with Codex. Private documents, transcripts, student work, experiments, backups and exports may contain sensitive content. Keep them out of Git. When requesting AI work, relevant source text and learner records are sent to OpenAI under the authenticated account's policies; URL retrieval also contacts remote source hosts. The app does not implement a local language model or promise that inference is offline.

Do not copy the isolated Codex home into a public repository, export, bug report, or shared backup. Do not log authentication content. To report a defect, prefer synthetic reproduction data and sanitized job IDs/errors.
