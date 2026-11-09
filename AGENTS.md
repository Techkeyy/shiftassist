# ShiftAssist: Agent Guide

ShiftAssist is a staff rota app for small restaurants and other shift teams. Signed-out visitors see the product page at `/`; signed-in managers land on Home (`/home`) and work through four steps. The assistant reads staff messages and helps; the scheduling code places every shift. See the ShiftAssist section below for routes, actions and rules.

## Skills

Search with `rg --hidden --follow`; read the exact linked guide before deeper work. `.agents/skills/build-an-app/SKILL.md` — start here for vague requests to create a domain app. `.agents/skills/adding-a-feature/SKILL.md` — cross-area feature checklist. Data/integrations: `.agents/skills/actions/SKILL.md`, `.agents/skills/storing-data/SKILL.md`, `.agents/skills/security/SKILL.md`, `.agents/skills/secrets/SKILL.md`, `.agents/skills/sharing/SKILL.md`. UI: `.agents/skills/frontend-design/SKILL.md`, `.agents/skills/shadcn-ui/SKILL.md`, `.agents/skills/client-side-routing/SKILL.md`. Agent context/workflows: `.agents/skills/context-awareness/SKILL.md`, `.agents/skills/real-time-sync/SKILL.md`, `.agents/skills/reliable-mutations/SKILL.md`, `.agents/skills/performance/SKILL.md`, `.agents/skills/delegate-to-agent/SKILL.md`. Framework: `.agents/skills/agent-native-docs/SKILL.md`, `.agents/skills/agent-native-toolkit/SKILL.md`, `.agents/skills/customizing-agent-native/SKILL.md`.

Use local docs only (no web research): `pnpm action docs-search --query "<topic>"`, `pnpm action docs-search --slug "<slug>"`, `pnpm action docs-search --list`, `pnpm action source-search --query "<pattern>"`, `pnpm action source-search --path <path>`, or `pnpm action source-search --list`. For external-agent integrations, read `pnpm action docs-search --slug "external-agents"`.

## Core rules

- UI feedback: target 100 ms, never exceed 400 ms; acknowledge before network work.
- Normal app data must flow through actions. Keep actions deterministic and focused; use agent chat/AgentSidebar for AI work and follow-ups in the same thread. Keep structured state in SQL and large files in configured storage; persist references only.
- For external integrations, inspect the workspace/provider connection catalog first; reuse its scoped resolver. Never hardcode credentials, webhook URLs, or private/customer data.
- Never fabricate. Report failures and recover; verify writes by reading the row or screen. Navigation is in `<current-screen>`; use `view-screen` for fresh visible-record details.

For custom branding, keep `server/plugins/agent-native-email-branding.ts` aligned: `app.name` appears in transactional email and optional `app.logoUrl` must be an absolute HTTPS URL.

## Application state

- `navigation` describes the view and selected ids. Home is `home` at `/home`; the steps are `team`, `rules`, `week` and `share`; full-page chat is `chat` at `/chat`; `/` is the signed-out product page.
- Use `navigate` when supported and `view-screen` for a fresh read of visible details; basic navigation is already in `<current-screen>`.

## Changing the app

Use `adding-a-feature` for functional parity and `frontend-design` for a user-facing screen. The guided steps live in `app/routes/` (`home`, `team`, `rules`, `week`, `share`) with components in `app/components/board/`; `app.homePath` is `/home` in `server/plugins/agent-native-email-branding.ts`. After edits, run `pnpm exec vitest run`, one typecheck, one doctor check, and one browser pass of the journey.

Before building common workspace or agent UI, read `agent-native-toolkit`; for supported customization, read `customizing-agent-native`.

- Guarded verification: run `pnpm agent-native:doctor`; fix findings before done.

## ShiftAssist

Staff rota app for small restaurants. The app is Home (`/home`, the default landing) plus four guided steps, each its own route: `/team` (view `team`), `/rules` (view `rules`), `/week` (view `week`), `/share` (view `share`). `/board` only redirects to the step that matches the week's state. The solver in `lib/solver/` is pure TypeScript; the model never places a shift. Public rota: `/s/:token` (server-rendered, no login, GET only) and `/api/public/schedule/:token`, both listed in `server/plugins/auth.ts` `publicPaths`.

| Action | Use |
| --- | --- |
| `get-week` | Owner's week: week start, staff ids, slot ids and holders, ALL rules with status, fairness, publish state, next step. Call first to turn names into ids. |
| `save-setup` | Staff plus typical-week shift pattern for a week start. Edits keep people (by id) and rules. Clearing a placed schedule or replacing the sample needs `confirmReplace: true` (ask the manager). |
| `propose-rules` | Store rules read from pasted messages as PROPOSED cards (staffName as written, weekday names or YYYY-MM-DD dates, `source` = the original sentence). Proposed rules never reach the solver. |
| `confirm-rules`, `save-rule` | Make rules confirmed. `needsApproval`: the manager's click is the approval. |
| `delete-rule` | Delete a rule on request. |
| `build-week` | Solve the week from confirmed rules, keeping locked shifts. Returns filled count, true reasons for unfilled shifts, fairness. |
| `move-shift` | `{ slotId, staffId, lock? }`. The only single-shift write. Re-checks hard rules; a locked shift cannot go to someone else ("This shift is locked. Unlock it first."). |
| `explain-shift` | Engine reasons, who else could have had the shift and what blocks them. |
| `slot-eligibility` | Read-only. Per shift, which other people could take it and the engine's reason for each who can't. Drives the board's allowed and blocked cells. |
| `find-cover`, `apply-cover` | Sick day. `find-cover` ranks options; `apply-cover` (`needsApproval`) makes the swap, marks the absent person off that date with a confirmed rule, and returns a message to copy. Nothing is sent. |
| `publish-week`, `unpublish-week` | Create / kill the unguessable public link. |
| `load-sample-week` | Labelled SAMPLE restaurant, with example staff messages. Refuses if a week exists unless `replace: true`. |

Reading staff messages (rules for the agent):
- Call `propose-rules` once with every rule. Never confirm rules yourself unless the manager says so in chat; `confirm-rules` still asks them to approve.
- Ambiguous message, or a name that matches nobody or two people: say so and ask. Still store the card (it shows "needs a person"); never drop a message silently.
- Relative dates ("this Thursday") become real dates inside the week on the board (get-week gives `week.startDate`); repeating rules use weekday names. hard = can't / must not; soft = would rather.
- The assistant may not claim anything was sent. There is no sending in v1.

Code rules:
- Every assignment write goes through `server/lib/assignments.ts` (`moveShift`, `buildWeek`, `applyCover`). Do not write the `shiftassist_*` tables any other way. `loadSchedule` loads CONFIRMED rules only.
- Every table has `owner_email`, set from `ctx.userEmail`. Never take an owner from client input. The only unscoped read is the public token lookup in `server/lib/publish.ts`.
- `server/plugins/agent-chat.ts` sets `frameworkTools: { database: "off" }` and `codeExecution.production: "off"`; keep them.
- The steps write `navigation` (`view`: `home`, `team`, `rules`, `week` or `share`) and a tab-scoped `selection` (`kind: "shift"`, `slotId`); `view-screen` returns the week snapshot on any of those views and the selected shift.
- Verify a write by calling `get-week` again, not from the tool result alone.
