# 05 · One entry surface, one management menu

Checkpoint 04 is `2c48e0c` (pushed). Its exact independent 7.0/10 report is preserved in [04-focus.md](04-focus.md#fourth-independent-review--exact-report). The score plateau is reported honestly; no critic is supplied with a previous review or a desired score.

## Structural response

The empty desk now contains the session-planning form itself. The learner writes a question, chooses a type and time, optionally attaches a source, and creates the session directly. New session and the keyboard shortcut focus this surface when the desk is empty. Opening a new session from existing work still uses a dialog, with one question field. The same form component serves both paths.

One Workspace menu now contains views, split commands, close, and reset. It replaces the separate row of management icons. The menu keeps explicit text for each command; mobile uses the current-view selector and a compact management menu. The navigation toggle now exposes expanded state, its controlled sidebar, and the current session in its tooltip.

Source passages have one attribution/open-source row. Purpose, formatter disclosure, and the original-layout reminder remain available under Source details. Source words and source-validation behavior are unchanged. Reading and writing use closer line measures and vertical rhythm; the writing area still grows with actual content.

## Capture correction

Inspection of the synthetic editor HTML found three paragraph nodes: the harness's Markdown-style double newline inserted an empty rich-text paragraph. The former large gap was actual fixture content, not a CSS defect. The harness now uses one rich-text Enter between exactly the same two paragraphs and asserts two paragraph nodes before saving. Earlier checkpoint images preserve the evidence. Real learner blank paragraphs are not removed or hidden.

Six final `05-one-surface` captures passed with no page exceptions or mobile overflow. Every PNG was inspected; the original PDF is painted, mathematical content is complete, and the saved response contains the same words. The first two states now show empty/filled stages of the same form instead of an empty desk followed by a duplicate modal.

A fresh maximum-reasoning GPT-6.1-Sol critic is reviewing these six images with the fixed prompt. The implementation remains GPT-6.1-Sol at extra-high reasoning. The review is pending and will be preserved verbatim when it returns.

## Fifth independent review — exact report

A fresh maximum-reasoning GPT-6.1-Sol agent received only checkpoint 05's six images and the fixed prompt.

**6.8/10.** The session brief and mobile layout are convincing. The setup form and working panes still feel assembled from tasteful defaults. This is competent editorial UI; the bespoke identity is thin.

The intended aesthetic is a scholarly desk: warm paper, bookish serif, restrained rust accents, fine rules. That direction suits Margin. The lack of cards, pills, shadows, and gradients is a strength. **Do not add decoration. Improve the editing.**

Three highest-leverage cuts:

1. **Delete half the setup form’s visible scaffolding.** The empty screen devotes more attention to session settings and source acquisition than to the question itself. The 140px textarea, paired selects, URL field, and upload panel create a conventional onboarding form beneath an editorial headline. Consolidate sources into one compact “Add a source” row; make the defaults quieter; tighten the question field. “Start with a question” plus its explanatory subtitle is familiar startup copy, carrying little distinctive voice.
2. **Delete duplicated hierarchy in the brief.** Objectives, activities, and the sidebar all repeat `01 / 02`. “Session brief” appears in both tab and eyebrow; the session title repeats in the sidebar; “Workspace” repeatedly labels the chrome. Keep numbering for activities, where it helps sequence. Render the two objectives as clean statements. The brief already has enough hierarchy through size, spacing, and rules.
3. **Delete decorative prose and incidental controls from the working surface.** “Understanding has to survive use” feels like generated brand philosophy pasted beneath a task. Remove it. The right toolbar scatters Assignment, response type, Saved, Format, and an eye icon across one loose line. Consolidate these into two compact groups. The PDF toolbar likewise needs a clearer distinction between essential reading controls and occasional tools.

Other visible polish problems:

- **The excerpt lacks editorial treatment.** In the reading pane, “Sampling, uncertainty, and independent observations” runs straight into the first sentence. A title, quotation, and learner instruction need distinct typographic roles. Currently the source is a substantial undifferentiated slab.
- The brief’s strongest gesture is its large title and heavy horizontal rule. Beneath that, repeated thin rules and generous empty bands flatten the rhythm. Compress secondary rows so the activities feel like the reason for the page.
- Tiny uppercase metadata and pale utility labels are overused. Mobile exposes this most clearly: the numbers and metadata become visual grit beside otherwise excellent, readable headings.
- Northeast arrows on internal activity rows suggest external destinations. Their repetition reads as a premium-template mannerism.
- The wordmark’s two vertical strokes are promising, but the rest of the interface never develops that idea. The identity presently depends almost entirely on beige plus serif.

For this exact concept, **Pentagram** would make the typography and numbering system more proprietary and enforce a much stronger editorial grid. **Apple** would reduce the visible setup decisions and make the working toolbar feel inevitable. **Teenage Engineering** would impose a precise operational grammar—consistent labels, numerals, alignments, and control groups.

The target should be **a recognizably authored research instrument**. The strongest next move is subtracting redundant labels and standard-form furniture, then sharpening the source-versus-authorship distinction.

This score does not establish the aspirational 9/10 standard. Reviews have plateaued; a coherent art-direction assessment will precede another implementation pass rather than merely repeating subtraction.

## Behavioral correction

The first browser run passed four workflows and timed out in two fixtures that still assumed New session always opened a modal. Coverage now distinguishes empty-desk focus from a saved-work dialog and waits for existing work to load before exercising the latter. The application also avoids treating an in-progress saved-work load as an empty desk. The source-validation assertion opens Source details instead of looking for the removed footer. A fresh production build precedes the full rerun.

Corrected validation passed: production build; **6/6 browser tests**, including both entry modes, menu-based management, source-details/URL controls, rich Markdown/math, focus reversal, and scanned PDF paint. Formatting and patch whitespace passed. The preceding core run remains 15/15, 0 skipped; server/protocol behavior is unchanged.
