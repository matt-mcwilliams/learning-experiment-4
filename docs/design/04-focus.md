# 04 · Give the documents the space

Checkpoint 03: `7782184`, pushed. Its independent 7.1/10 review and exact report are retained in [03-deliver.md](03-deliver.md). Implementation throughout this continuation uses **GPT-6.1-Sol, extra-high reasoning**. Independent visual critics use **fresh GPT-6.1-Sol agents at maximum reasoning**, screenshots only, unchanged prompt, with no prior scores or target outcome supplied.

## Changes

Splitting the actual workspace now collapses the sidebar once. Restoring a saved split does the same. The existing navigation toggle remains visible and keyboard/screen-reader reachable; reopening it preserves the split and is not undone by ordinary resize events. This is product behavior, not a capture-only arrangement. Single-pane briefs keep their existing navigation.

Source selection and PDF controls share one compact header. Source upload and URL retrieval remain in the native Sources disclosure. The instructional strip appears when an annotation action needs it. The original PDF, its page whitespace, and all annotation geometry remain authoritative; no source content was resized, cropped, or rewritten to manufacture a prettier document.

The writing pane starts with one compact line for assignment, work format, saved state, Format, and reading view. Format reveals the existing rich-text toolbar; keyboard formatting remains available. Assignment contains criteria and the explicit closed-book action. Submission stays visible, while hints and the personal completion marker stay in More actions. Python remains separate. Source excerpt type is slightly smaller than the learner's writing.

The capture harness now moves the pointer to a neutral corner before each image. Checkpoint 03's accidental hover states remain in the history. The rust activity title and dark overflow hover were not selected states. The six new captures follow the same ordinary entry, split, PDF, and mobile actions; the harness adapts to the actual sidebar state.

## Verification

Production build and six synthetic captures passed. All six images were visually inspected, including painted original PDF text, complete mathematical prose, saved learner response, and the mobile selector. `npm run test:browser`: **6/6 passed**, including the new format/assignment disclosure flow, sidebar reopening with the split intact, saved rich Markdown/math, empty-workspace recovery, mobile switching, PDF annotations, zoom, scrolling, scanned-image paint and bounded canvas mounting. The preceding core run remains **15/15 passed, 0 skipped**; no backend/protocol change has been made since it. `git diff --check` passed.

A new independent screenshot-only maximum-reasoning GPT-6.1-Sol critic is reviewing checkpoint 04. Its report will be preserved when it returns; the implementation checkpoint is being saved independently of that review.
