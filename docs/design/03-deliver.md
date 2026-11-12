# 03 · Media assessment and delivery passes

Checkpoint 02 is `f31b625` (pushed). The two independent proof-of-concept reviews scored 6.4 and 6.6; the full reports remain in [02-critique.md](02-critique.md). The modest movement shows that more color/style changes are insufficient.

## 4. Image assessment

Evaluated an editorial cover illustration, a paper texture, a research-desk photograph, and a pictorial empty state against the six actual work states. None would clarify a source, explain evidence, or help the learner decide what to do. A source reader must privilege the original document and the learner's reasoning; invented imagery would consume that space. Paper texture would also reduce text contrast. Keep the code-native two-rule Margin mark and original source images instead.

No raster was generated. The user required GPT-6.1-Sol for all work; that model does not produce image files. Substituting another generative model would violate that constraint. There is no need to request such a substitution for a decorative asset. This is an explicit suitability assessment, not a claim that image generation was performed.

## 5. Video and motion assessment

Evaluated ambient video, animated page transitions, and a moving brand mark. Repeated motion would compete with close reading and create latency around saved local work. No video was generated, and no other generative model was used. Keep only useful interaction feedback: immediate view changes, hover/focus state changes, and an existing progress indicator while work is actually running. The existing reduced-motion rule disables animation and transitions. Verify that preference in the browser rather than adding ornamental motion.

The image assessment preceded this motion assessment; both preceded the following explicit delivery passes.

## 6. Subtraction

Implemented and inspected in six disposable captures before starting procedure 7: workspace actions now share the document tab strip (one full chrome row removed). Mobile uses an explicit current-view selector instead of clipped tabs and an unexplained overflow count. Writing has one format selector, a saved state, a formatting bar, word count, and Submit. Hints and the personal completion marker are under More actions. The reader retains source provenance; Python remains a distinct format. Empty workspaces retain a Views recovery control. Mobile spacing now reaches both activities within the initial brief viewport. Contextual controls preserve all capabilities.

## 7. AI-tells audit

Implemented after the subtraction pass: session setup now uses a native session-type selector; attached files become plain rows; URL retrieval opens only when requested. The decorative empty-chat mark and repeated reassurance lines are removed. No gradients, glows, bento grids, floating badges, or novelty controls are needed. Original source images, progress states, safety disclosures, and focus outlines have functional value. TypeScript passed before the following copy pass.

## 8. Editorial copy pass

Completed after the AI-tells audit. This is an assistant-authored editorial pass, not a claim of human authorship. “Start with a question,” “What to establish,” “Activities,” and “Source passage” replace the literary slogan and instructional headings. Section labels and controls use sans type; serif is reserved for authored titles and prose. Concrete descriptions remain when they explain an action. Source quotations and generated learning material were not edited.

## Checkpoint 03 and verification

All six `03-working-edition` captures passed with no page exceptions or mobile document overflow. Visual inspection confirms painted original PDF content, complete formatted prose and mathematics, the saved sample response, and readable mobile navigation. A fresh GPT-6.1-Sol maximum-reasoning critic is evaluating only these images with the unchanged prompt.

The first browser run passed five workflows, including the new close-every-view/reopen-from-empty path and the mobile view selector. Its first test timed out because an accessible-name correction was tested against the preceding production bundle. This was a build/test ordering error: the source and fixture never changed their expected behavior. A fresh production build precedes the corrected run. No live inference was needed because the Codex protocol and prompts are unchanged.

Corrected final validation: production build passed; **15/15 core tests, 0 skipped**; **6/6 browser tests**; formatting and patch whitespace passed. Browser coverage includes reduced-motion preference, actual rich Markdown/math saving, split reload, closing every view and reopening from the empty workspace, mobile selection, geometric annotations, painted scanned PDFs, and bounded canvas mounting. React review: module-level header components and contexts preserve component identity; controls retain labels, native selects, expanded state and focus behavior; saved layouts and draft hooks are unchanged. No new dependencies were added.

## Third independent review — exact report

A fresh GPT-6.1-Sol maximum-reasoning agent saw only checkpoint 03's six screenshots and the fixed prompt.

**Polish score: 7.1/10.** Restrained, coherent, credible. The session brief approaches good editorial design; the working views remain a conventionally assembled productivity app. This is average agency polish with stronger typography.

The intended aesthetic is a scholar’s desk interpreted as a contemporary literary journal: warm paper, dark serif typography, restrained rust, numbered sections, thin rules. That direction suits Margin. The brief and mobile screens express it most convincingly.

What works:

- The brief’s title, question, heavy rule, objectives, and activities form a clear hierarchy.
- Mobile has excellent title wrapping and comfortable margins. It feels composed, not squeezed.
- Squared controls, restrained color, and the absence of decorative cards support serious work.
- The wordmark has presence without becoming a startup logo performance.

Where the finish breaks:

- **The permanent sidebar dominates the working views.** Its 223 pixels contain mostly inactive navigation and repeated session information, while the PDF and writing panes compete for space. The application gives its furniture a better seat than the documents.
- **The visual grammar changes when work begins.** The brief is editorial; the PDF view becomes a pile of utility bars. Tabs, source selector, attach controls, annotation controls, pagination, zoom, instructional strip—five horizontal bands before the page begins.
- **The writing pane has the same accumulation problem.** “Assignment,” “Begin closed-book attempt,” “Written response,” “Saved,” an eye icon, and a formatting toolbar precede the actual writing. Each element is individually reasonable; the combined composition lacks a dominant idea.
- **The second activity’s rust title appears selected while the sidebar selects the first activity.** Color currently suggests a state that the rest of the screen contradicts.
- **The source excerpt is disproportionately grand.** Its large serif body competes with the learner’s writing and turns a supporting passage into the largest visual event. The source’s title runs directly into the first sentence, weakening document structure.
- **The PDF is visually stranded.** A huge white sheet carries tiny text at its top, surrounded by warm gray, while the response looks like a polished manuscript. The two halves feel like different products.
- **The new-session modal is generic form design.** The opening question appears twice in the visible composition. The URL field and bare filename row feel appended rather than deliberately integrated.
- **Small utility text is too uniformly faint.** Navigation, source metadata, assistance, status, and secondary actions occupy the same gray register. Quietness has flattened hierarchy.
- **The logo’s two vertical strokes feel unresolved.** The rust hairline and heavier black bar could become a distinctive margin device, but elsewhere the interface uses unrelated rules, underlines, and selection bars.

The remaining AI tells are subtler than purple gradients: the fashionable beige/serif/rust formula, repeated labels describing the obvious, plentiful hairline dividers, generic outline icons, and an inspirational empty-state headline. No pill-tag infestation or card-within-card fatigue here.

**The three highest-leverage cuts:**

1. **Collapse the sidebar during reading and writing.** Retain a compact navigation affordance and the current session identity. Give the documents the space.
2. **Delete two-thirds of the permanently visible utility chrome.** Use one compact header per pane; reveal formatting and annotation options in context.
3. **Remove repeated framing.** One question-entry surface, one session title, one clear activity state. Reduce rules and labels that merely announce the next section.

Pentagram would make the margin itself a rigorous identity system: exact alignment, consistent numbering, distinctive editorial typography. Apple would concentrate attention on the active document and ruthlessly consolidate controls. Teenage Engineering would make the utility layer explicit and disciplined—compact instrument panels with precise state signals. Margin presently borrows editorial atmosphere without extending that rigor into its working tools.

**Preserve the brief’s character. Apply its discipline to the workspace.**

The review has improved to 7.1, below exceptional polish. Follow-up will improve ordinary split-workspace behavior, not invent a presentation-only screenshot state. The rust activity title and gray overflow hover in checkpoint 03 also exposed a capture flaw: the pointer stayed where the preceding action landed. Those images remain as evidence; subsequent captures will move the pointer to a neutral corner before taking the image.
