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

## Fourth independent review — exact report

Checkpoint 04 was committed and pushed as `2c48e0c` before the report returned. A fresh maximum-reasoning GPT-6.1-Sol critic saw only its six images and the unchanged prompt.

**Polish: 7.0/10.** Credible agency work with a coherent aesthetic. The session brief and mobile layout are strongest. The working views reveal less resolved hierarchy and excessive chrome.

The intended aesthetic is a scholarly desk: ivory paper, charcoal serif, rust marginalia. It suits Margin. The problem is familiarity: large literary headline, hairline rules, numbered rows, muted labels, diagonal arrows. These signals establish taste, but still feel interchangeable with a premium editorial template.

**Three highest-leverage deletions:**

1. **Remove half the workbench chrome.** The PDF view has tabs, truncated navigation, Views, layout controls, close/reset controls, and a second dense icon toolbar. Several compete within a few pixels. Consolidate workspace management into one menu; let page navigation and zoom dominate the PDF toolbar. On mobile, Views and reset occupy valuable header space without helping explain the current screen.
2. **Collapse the source-passage preamble.** “Source passage,” provenance, “Open source,” instructional copy, dividers, and the tiny disclaimer create an administrative sandwich around the actual text. One attribution row would do. The excerpt should arrive substantially earlier and feel like material on the desk.
3. **Use one session-entry surface.** The empty desk’s enormous question field followed by a modal containing another question field is visually repetitive. Integrate planning into the original composition. The modal is competent, but its gray scrim and conventional form grid interrupt the product’s distinctive quietness.

Across the six images:

- **Empty desk:** attractive typography, but the composition stops after the form. It reads like a landing page inserted into an application. The oversized serif placeholder competes with the headline.
- **New session:** orderly and readable. The heavy rust focus outline is noticeably louder than everything around it; the backdrop feels muddy.
- **Session brief:** the best desktop composition. Numbered activities, restrained rules, and generous margins work. Tiny uppercase metadata and repeated session identity in the sidebar weaken its otherwise confident hierarchy.
- **Reading and writing:** the left side is dense with framing; the right side has huge paragraph gaps and a detached submission area. They need a common vertical rhythm. The response currently looks typeset for presentation rather than composed in an editor.
- **Source and writing:** a useful pairing, visually undermined by the crowded toolbar and ambiguous miniature icons.
- **Mobile brief:** convincing typographic adaptation. Secondary metadata is too small and faint, while the header still exposes desktop workspace machinery.

**AI tells:** no gratuitous gradients, pills, or card nesting. The tell is the assembled “tasteful editorial” vocabulary: serif, beige, rust, rules, `01`, northeast arrows. Each is reasonable; together they need a stronger proprietary idea.

**Pentagram** would build an unmistakable identity around actual margins and annotation, with more deliberate asymmetry and typography. **Apple** would resolve action hierarchy, contextual controls, and secondary-text legibility obsessively. **Teenage Engineering** would make the workspace feel like an instrument: compact controls, explicit states, disciplined numbering.

Pursue the Pentagram lineage. The product already has enough restraint; it needs more authorship and fewer controls.

The 7.0 score is a slight regression from 7.1, not convergence. The next checkpoint implements the three structural findings in normal product flows.
