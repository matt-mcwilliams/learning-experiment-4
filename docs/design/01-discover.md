# 01 · Discover and establish the brief

## 1. Random discovery

The interrupted implementation had no recoverable seed record. On resuming, the discovery exercise was repeated before judging or extending the first proof of concept. This is a new recovery seed, not a reconstructed history. It was generated with Node's cryptographic `randomBytes(96)`, encoded as base64url and filtered to alphanumeric characters:

```text
ceeInhj2tWn1NK2SXUiuF4n9BkWXQbmPHBVVWYohOrnmgQ2qB3tvmGvd3r2587rlNM9xjdfkBvZJeZPxTMFvpewX8JivXd9W7EFUaqrUPULIXLb6bxacORqCmNWS2
```

The seed is process material only. Its subpatterns are associative prompts, not a claim that random characters determine good design.

| Subpattern  | Distinct direction      | Concise concept                                                                                                              |
| ----------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `ceeInhj2`  | Field notebook          | Olive covers, rough section dividers, narrow handwritten-style metadata; an expedition record for investigations.            |
| `NK2SXUiu`  | Optical instrument      | Charcoal, white, precise blue ticks, monospaced controls; a calibration bench for thinking.                                  |
| `QbmPHBVV`  | Editorial research desk | Bone paper, dense ink, restrained rust, serif arguments and ruled margins; an authored journal that is also useful software. |
| `Gvd3r2587` | Laboratory ledger       | Numbered observations, graph-paper rhythm, tabular evidence, sober green; rigor expressed through structure.                 |
| `JeZPxTMF`  | Contemporary archive    | Huge catalog numerals, black/ivory contrast, asymmetric indexes; a working collection of questions and sources.              |
| `UPULIXLb`  | Night study             | Deep navy, warm text, amber annotations, almost no borders; an intimate late-night reading room.                             |

The user selected **“Editorial research desk — warm paper, ink, precise margin rules.”** That choice governs the implementation. The recovery exercise confirms the interrupted direction rather than replacing the user's decision.

## 2. Ambitious brief

Build Margin as a serious research instrument with the visual authorship of a small independent journal. The interface should make a difficult question feel worth sustained attention. Let the learner's work carry the page: a session title, a clear proposition, a route through the work, then the original source and the learner's reasoning side by side.

Use warm, nearly white paper; dark brown-black ink; a single rust accent for decisions and current position. Pair Source Serif 4 with Inter for controls and a quiet monospace for numbering. Use hairlines for relationships and a heavier rule only for a major editorial division. Set a readable measure and deliberate vertical rhythm. Make active views unmistakable, while keeping split-pane controls and secondary utilities subordinate. The two-rule mark should evoke a margin without drawing attention away from the work.

Give the empty desk one invitation. Avoid an ornamental illustration, marketing hero, background texture, gratuitous badges, stacked containers, or decorative animation. Keep actual research content, evidence, source provenance, uncertainty, and drafts intact. Never restyle a source quotation into different words. Preserve the PDF reader, Markdown/math round-trip, separate Python workspace, existing saved layouts, and all existing capabilities.

Desktop must feel like one continuous work surface. Mobile must retain readable text and reachable navigation without horizontal page overflow. Judge the empty desk, session creation, brief, reading/writing split, PDF/writing split, and mobile brief together. Subsequent independent critics see only those screenshots and the fixed critique prompt, never code, previous scores, or this brief.

## Proof of concept

Checkpoint `01-editorial-desk` establishes the palette, compact sidebar, two-rule mark, authored session heading, clearer active tabs, a shorter default view set, and a ruled invitation on the empty desk. It deliberately precedes the independent refinement and final subtraction/copy passes.

Verified: `npm run build`; six synthetic captures through `scripts/design-checkpoint.ts`; no browser exceptions; no horizontal document overflow at 390 px. Visual inspection confirms painted PDF text, source excerpts, equations, the saved sample response, and the mobile brief. The existing Vite chunk-size advisory remains.
