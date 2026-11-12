# Margin design review

This is a chronological review trail for the workspace redesign. All screenshots use the original, synthetic sampling fixtures in a disposable database. They contain no learner documents, personal work, or inference output. The capture script refuses to reuse an existing server.

## Checkpoints

| Checkpoint    | Review                                                                                                                                                                                                                                                                                                                                                                        | Verification                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 00 · Baseline | [Empty desk](checkpoints/00-baseline/01-empty-desk.png), [new session](checkpoints/00-baseline/02-new-session.png), [brief](checkpoints/00-baseline/03-session-brief.png), [reading + writing](checkpoints/00-baseline/04-reading-and-writing.png), [PDF + writing](checkpoints/00-baseline/05-source-and-writing.png), [mobile](checkpoints/00-baseline/06-mobile-brief.png) | Production build; six captures; no browser exceptions; mobile document has no horizontal overflow |

Baseline commit: `7e5f33d`. The first empty-desk capture exposed a harness race: clicking “Decide later” returned before its asynchronous save removed onboarding. That imperfect image is retained. [Corrected empty desk](checkpoints/00b-capture-correction/01-empty-desk.png) and [corrected brief](checkpoints/00b-capture-correction/03-session-brief.png) wait for the dialog to close. All six states were recaptured under `00b-capture-correction`, with no interface changes.

The independent screenshot-only baseline critic scored **6.3/10**. Its three highest-priority findings were duplicated navigation, nested editor shells, and pervasive explanatory microcopy. It also noted weak active-tab contrast, pale tiny labels, a mechanically spread brief, and an assembled-looking monogram. These findings are recorded as evidence, not as a numerical target for subsequent critics.

## 01 · Editorial proof of concept

[Discovery and precise brief](01-discover.md). [Empty desk](checkpoints/01-editorial-desk/01-empty-desk.png), [new session](checkpoints/01-editorial-desk/02-new-session.png), [brief](checkpoints/01-editorial-desk/03-session-brief.png), [reading + writing](checkpoints/01-editorial-desk/04-reading-and-writing.png), [PDF + writing](checkpoints/01-editorial-desk/05-source-and-writing.png), [mobile](checkpoints/01-editorial-desk/06-mobile-brief.png). Build and six captures passed. The next step is an independent screenshot-only critique.

## Ordered design procedures

1. **Random discovery:** complete; [recovery seed and six directions](01-discover.md#1-random-discovery). The seed never appears in the interface.
2. **Ambitious brief:** complete; [editorial research desk brief](01-discover.md#2-ambitious-brief), based on the user’s chosen taste.
3. **Independent critique:** in progress; each critic receives only screenshots and the same fixed visual critique prompt. Critics do not read implementation, previous critiques, or a target score.
4. **Image assessment:** pending after the first refinement.
5. **Motion assessment:** pending after the image assessment.
6. **Subtraction:** pending.
7. **AI-tells audit:** pending.
8. **Copy edit:** pending.

## Repeat a capture

```sh
npm run build
npx tsx scripts/design-checkpoint.ts docs/design/checkpoints/<number-name>
```

The script starts `tests/browser-server.ts` on port 4517, creates one synthetic paper-study session, saves a sample response, opens a split, and captures desktop and mobile states. It terminates the server and removes its temporary database. This is separate from production startup and never calls the Codex adapter. Review PNGs visually; the capture harness supplements the full browser regression suite.
