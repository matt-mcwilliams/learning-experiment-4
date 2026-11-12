# Margin design review

This is a chronological review trail for the workspace redesign. All screenshots use the original, synthetic sampling fixtures in a disposable database. They contain no learner documents, personal work, or inference output. The capture script refuses to reuse an existing server.

## Checkpoints

| Checkpoint    | Review                                                                                                                                                                                                                                                                                                                                                                        | Verification                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 00 · Baseline | [Empty desk](checkpoints/00-baseline/01-empty-desk.png), [new session](checkpoints/00-baseline/02-new-session.png), [brief](checkpoints/00-baseline/03-session-brief.png), [reading + writing](checkpoints/00-baseline/04-reading-and-writing.png), [PDF + writing](checkpoints/00-baseline/05-source-and-writing.png), [mobile](checkpoints/00-baseline/06-mobile-brief.png) | Production build; six captures; no browser exceptions; mobile document has no horizontal overflow |

Baseline commit: `7e5f33d`. The first empty-desk capture exposed a harness race: clicking “Decide later” returned before its asynchronous save removed onboarding. That imperfect image is retained. [Corrected empty desk](checkpoints/00b-capture-correction/01-empty-desk.png) and [corrected brief](checkpoints/00b-capture-correction/03-session-brief.png) wait for the dialog to close. All six states were recaptured under `00b-capture-correction`, with no interface changes.

The independent screenshot-only baseline critic scored **6.3/10**. Its three highest-priority findings were duplicated navigation, nested editor shells, and pervasive explanatory microcopy. It also noted weak active-tab contrast, pale tiny labels, a mechanically spread brief, and an assembled-looking monogram. These findings are recorded as evidence, not as a numerical target for subsequent critics.

## 01 · Editorial proof of concept

[Discovery and precise brief](01-discover.md). [Empty desk](checkpoints/01-editorial-desk/01-empty-desk.png), [new session](checkpoints/01-editorial-desk/02-new-session.png), [brief](checkpoints/01-editorial-desk/03-session-brief.png), [reading + writing](checkpoints/01-editorial-desk/04-reading-and-writing.png), [PDF + writing](checkpoints/01-editorial-desk/05-source-and-writing.png), [mobile](checkpoints/01-editorial-desk/06-mobile-brief.png). Build and six captures passed. Commit: `043c218` (pushed). The independent review scored **6.4/10**; [exact report and response](02-critique.md).

## 02 · Editorial discipline

[Exact independent review and response](02-critique.md). [Empty desk](checkpoints/02-editorial-discipline/01-empty-desk.png), [new session](checkpoints/02-editorial-discipline/02-new-session.png), [brief](checkpoints/02-editorial-discipline/03-session-brief.png), [reading + writing](checkpoints/02-editorial-discipline/04-reading-and-writing.png), [PDF + writing](checkpoints/02-editorial-discipline/05-source-and-writing.png), [mobile](checkpoints/02-editorial-discipline/06-mobile-brief.png). Commit: `f31b625` (pushed). Build, 15 core tests (0 skipped), six browser tests, formatting, and patch checks passed. Independent review: **6.6/10**, not yet converged.

## 03 · Working edition

[Media assessments and ordered delivery passes](03-deliver.md). [Empty desk](checkpoints/03-working-edition/01-empty-desk.png), [new session](checkpoints/03-working-edition/02-new-session.png), [brief](checkpoints/03-working-edition/03-session-brief.png), [reading + writing](checkpoints/03-working-edition/04-reading-and-writing.png), [PDF + writing](checkpoints/03-working-edition/05-source-and-writing.png), [mobile](checkpoints/03-working-edition/06-mobile-brief.png). All six captures passed and were visually inspected. Commit: `7782184` (pushed). Full validation passed. Independent review: **7.1/10**; [exact report](03-deliver.md#third-independent-review--exact-report).

## 04 · Focused desk

[Behavior, model metadata, and verification](04-focus.md). [Empty desk](checkpoints/04-focused-desk/01-empty-desk.png), [new session](checkpoints/04-focused-desk/02-new-session.png), [brief](checkpoints/04-focused-desk/03-session-brief.png), [reading + writing](checkpoints/04-focused-desk/04-reading-and-writing.png), [PDF + writing](checkpoints/04-focused-desk/05-source-and-writing.png), [mobile](checkpoints/04-focused-desk/06-mobile-brief.png). Production build, six captures, and six browser tests passed. The fresh independent review is pending.

## Ordered design procedures

1. **Random discovery:** complete; [recovery seed and six directions](01-discover.md#1-random-discovery). The seed never appears in the interface.
2. **Ambitious brief:** complete; [editorial research desk brief](01-discover.md#2-ambitious-brief), based on the user’s chosen taste.
3. **Independent critique:** in progress; each critic receives only screenshots and the same fixed visual critique prompt. Critics do not read implementation, previous critiques, or a target score.
4. **Image assessment:** complete; [assessed and omitted](03-deliver.md#4-image-assessment). Decorative raster imagery would reduce space for sources and work; no model substitution was made.
5. **Motion assessment:** complete after the image assessment; [useful feedback only](03-deliver.md#5-video-and-motion-assessment), with reduced motion preserved.
6. **Subtraction:** complete; one workspace chrome row and persistent writing scaffolding removed. See [delivery notes](03-deliver.md#6-subtraction).
7. **AI-tells audit:** complete; native selectors, plain attachment rows, fewer ornaments. See [audit](03-deliver.md#7-ai-tells-audit).
8. **Copy edit:** complete; [concise editorial pass](03-deliver.md#8-editorial-copy-pass), preserving source and learning content.

## Repeat a capture

```sh
npm run build
npx tsx scripts/design-checkpoint.ts docs/design/checkpoints/<number-name>
```

The script starts `tests/browser-server.ts` on port 4517, creates one synthetic paper-study session, saves a sample response, opens a split, and captures desktop and mobile states. It terminates the server and removes its temporary database. This is separate from production startup and never calls the Codex adapter. Review PNGs visually; the capture harness supplements the full browser regression suite.
