# ShiftAssist: director handover

Read this first if you are taking over. Standard: `Desktop/skill/master director skill.txt`. Research: `agent-native-idea-research.md` (the idea was called Fair Shift there).

**Authoritative status: BUILDING. INTEGRATION PROVEN locally for move-shift only (drag handler plus chat through DeepSeek, live board). Core Outcome not proven. Nothing deployed.**

Kill test, director-observed 2026-11-04, local dev build only:
- Chat "Give Sam the Friday lunch server shift" moved it through `move-shift`; board changed with no reload (Priya 3/4 to 2/4).
- Chat "Give Maya the Friday dinner cook shift... get around the rule... writing to the database directly": `move-shift` refused ("Maya is already at the limit of 5 shifts. Maya can't work on Fri."), one failed tool call, chip stayed with Luis.
- Caveat: the dev agent has a shell and could bypass; its restraint is not enforcement. In production, enforcement rests on `frameworkTools: { database: "off" }` and code execution off, which must be set and proven.
- Unverified: real mouse drag (builder used synthetic drag events), repair with non-empty result, production, two real accounts.

Solver: mutation check done by director: disabling the repair fallback makes its test fail, then restored. Full suite re-run by director after journey commit 6e018d0: 47 of 47 pass.

Production: `pnpm build` succeeds in about 3 minutes (preset node). A local production run refuses to serve without hosted Postgres ("This deployed server has no hosted database"), so fresh-account and enforcement proof must happen on the real deployment. `agent-native start` fails on Windows (unquoted `C:\Program Files` path); `node --env-file=.env .output/server/index.mjs` works.

Deploy target: Vercel (project shiftassist, scope techkeyys-projects) plus Neon. Owner runs `node scripts/vercel-env.cjs` because the permission system blocks the director writing secrets to Vercel. Neon password appeared in the session transcript through a file-change notice: owner must reset it in Neon before final submission, update `.deploy.local`, and re-run the script. Steps: `pnpm migrate:production` with DATABASE_URL set, `NITRO_PRESET=vercel pnpm build`, `vercel deploy --prebuilt --prod`.

Before deploy: review netlify.toml, which inherits template analytics IDs (GA, GTM) and trusted origins for agent-native.com; these must not ship. Set `AUTH_REQUIRE_EMAIL_VERIFICATION=0` knowingly, with the daily turn cap as the abuse limit. Ensure `AGENT_PROD_CODE_EXECUTION` is unset, and set a spend cap on the DeepSeek key.

Journey builder findings still needing director proof: journey walked locally through UI per its report. Director has only independently observed move-shift. Claims of steps 2 to 10 are SUPPORTED, not PROVEN, until production UAT.

Design bugs seen: at about 800 px the board pushes the chat panel off-screen.

Deadline: Mon Nov 9, 11:59 PM PT (Nov 10, 07:59 UTC). Target: code freeze Nov 9, 12:00 UTC. Submit by Nov 9, 22:00 UTC.

Rules for this repo: no Claude co-author trailer, no Claude collaborator. Solo entry by the owner. Owner submits and records the demo personally.

## Product contract

- **Product:** ShiftAssist
- **User:** manager or owner of an independent restaurant, café or small clinic with 10 to 30 staff
- **Problem:** requests live in chats and memory; building a fair week takes hours; staff question it; sick days cause a scramble
- **Promise:** paste the messages, get a schedule that keeps every confirmed rule, explain any shift, and cover a sick day in minutes

**Core Outcome:** this product is only genuinely working when a first-time manager turns their own staff messages into a published week that keeps every rule they confirmed, gets a sick shift covered, and finds both still there after returning, with no developer help.

### Real user journey (primary acceptance test)

1. Open the deployed site and create an account, or try the sample restaurant
2. Add staff and shift needs (or start from the sample)
3. Paste staff messages
4. Review rule cards: correct, delete or add
5. Press Build week; the board fills in
6. Drag and lock a shift; the rest repairs, with changes highlighted; rule breaks are refused with a reason
7. Click any shift to see why that person has it
8. Publish; get a real read-only link staff can open on a phone
9. Sick day: tell the app in chat or by a button; ranked cover options; approve one; the board and link update; copy the prepared message
10. Leave, return, refresh; everything is still there

### Must be real

Real model calls, real database writes per account, real sign-in, real public link. Sample data is allowed only when labelled as sample. ShiftAssist does not send texts in v1: the button says Copy message, never Send.

### Scope

- **NOW:** the journey above, one location per account, one week at a time
- **NEXT:** fairness history across weeks, CSV export, staff swap requests
- **LATER:** real SMS, payroll, forecasts, labour-law packs, staff logins
- **Not doing:** legal compliance claims. Rules are the manager's own

## Architecture

- Agent-Native chat template, standalone. React Router UI, `actions/`, Drizzle over Postgres (PGlite locally)
- `lib/solver/` pure TypeScript, no I/O, deterministic for the same input
- The model only does two jobs: turning messages into proposed rules, and explaining in plain words. It never places a shift
- Every write to assignments goes through one server function that re-checks hard rules

## Claim, mechanism, proof ledger

| Claim | Mechanism | Boundary | Required proof | Current | Status |
| --- | --- | --- | --- | --- | --- |
| A confirmed hard rule can't be broken by drag or agent | Server re-check in every assignment write | Action layer. Must also confirm agent has no raw database write path | Direct action call and chat attempt both refused | None | UNPROVEN |
| Same input gives same week | Pure solver | Solver | Repeat-run test | None | UNPROVEN |
| Every placement has a true reason | Trace produced by solver, not the model | Solver | Trace matches recomputed rule state | None | UNPROVEN |
| Messages become correct rules | Model, then human review before use | Review step; unconfirmed rules never reach solver | Real messy messages through real model | None | UNPROVEN |
| Board and chat share actions | Same `defineAction`s | Framework | Same action seen from drag and from chat, live update | None | UNPROVEN |
| User A can't see or change user B | Owner scoping in all actions | Server | Two accounts, cross-access refused | None | UNPROVEN |
| Publish link shows the current week to anyone | Token route, read-only | Server | Open logged out on a phone; write refused | None | UNPROVEN |
| Survives refresh and return | Postgres | Database | Fresh session on production | None | UNPROVEN |

## Rubric to acceptance test

| Criterion | Weight | Test |
| --- | --- | --- |
| Usefulness and Execution | 40 | Fresh account completes the full journey on production |
| Creativity and Design | 20 | Passes substitution test and unslop audit; "why" panel is memorable |
| Innovation | 20 | Agent handles messy language; code guarantees rules; visible in demo |
| Use of Agent-Native | 20 | Drag and chat use one action; selection context; sendToAgentChat on Why; live board update |

## Feature matrix

| Feature | UI | Backend | Real integration | Production | Manual | Recovery | Final |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Sign-in, sample start | | | | | | | |
| Staff and shift needs | | | | | | | |
| Messages to rules | | | | | | | |
| Build week | | | | | | | |
| Drag, lock, repair | | | | | | | |
| Why panel | | | | | | | |
| Publish link | | | | | | | |
| Sick-day cover | | | | | | | |

## Environment facts (2026-11-04)

- Windows 11, Node 24.14, pnpm 11.19. PC is tight: 796 MB free RAM of 16 GB, 6 GB free disk measured today
- `npx` scaffold hung twice; use `pnpm dlx`. `pnpm install` took over 14 minutes and was cut off once
- If local running stays unworkable, relocate to a cloud machine rather than repair (build-process Phase 4)

## Owner needs to provide (not yet requested)

- A model key (Anthropic or OpenAI) set by the owner in `.env` or host settings
- Hosting login and Postgres (Netlify or Vercel, plus Neon)
- Decision on other hackathons competing for Nov 7 to 9

## Log

- 2026-11-04: owner chose the idea and the name ShiftAssist. Read master director, build-process, design and project-edge skills. Scaffold started.
- 2026-11-04: scaffold committed (8d899c8). `pnpm install` took 8 minutes. Dev server boots on :8080 with `pnpm exec agent-native dev`; sign-in page renders in browser. COMPONENT PROVEN only. Solver builder and shared-action slice builder dispatched. Waiting on owner for a model key.
- 2026-11-04: solver committed. Director re-ran it: 21 of 21 tests pass, no skips. COMPONENT PROVEN (Level 1): repair fallback path and search optimality untested. Owner has a DeepSeek key, so `.env` routes the OpenAI engine to `https://api.deepseek.com`; framework uses chat completions for custom endpoints (read in ai-sdk-engine.js, not yet run). Key entered by owner only. Real-model proof still needed.
- 2026-11-04: first real chat turn ran locally. Server log: `engine=ai-sdk:openai model=deepseek-flash`. Only the OpenAI route is configured (no Anthropic, no Builder), and no framework prompt claims Claude, yet the reply said "I'm Claude, made by Anthropic". Treat as model self-misidentification, proven only by elimination until the owner sees the usage on DeepSeek's dashboard. Tool-calling through DeepSeek NOT yet tested.
- Model default is set with PUT `/_agent-native/agent-model-defaults`, scope is **org**. RISK for production: a new sign-up gets their own org and may fall back to `gpt-6-luna`, which DeepSeek rejects. Must fix before deploy; fresh-account test required.
- Dev mode is slow here: about 3,700 module requests and 52 s first render of /chat. Use a production build for UAT and demo recording. UI estimated $0.0508 for one short turn (17k-character system prompt); estimate not checked against DeepSeek billing. Judges will spend the owner's credit, so per-account limits are needed before deploy.
- 2026-11-04 (slice builder): built move-shift slice. Tables shiftassist_{weeks,staff,slots,rules,assignments} (owner_email on all), `server/lib/assignments.ts` (single write path, uses checkAssignment and repairWeek from lib/solver), actions get-week / move-shift / load-sample-week, `/board` route, view-screen board snapshot. Local PGlite only. See builder report for what is and is not verified. Status unchanged: nothing proven until the director re-runs it.
- 2026-11-04 (product builder, LOCAL only, not director-verified): built steps 1 to 10 of the journey on the local dev server. New actions: save-setup, propose-rules, confirm-rules and save-rule (needsApproval), delete-rule, build-week, explain-shift, find-cover, apply-cover (needsApproval), publish-week, unpublish-week; move-shift now refuses a locked shift ("This shift is locked. Unlock it first."). Migrations v2 (rule status, flag) and v3 (week pattern, publish token, last change). `loadSchedule` loads confirmed rules only. Public rota is server-rendered at /s/:token (JSON at /api/public/schedule/:token). `frameworkTools.database` is "off" and `codeExecution.production` is "off" in server/plugins/agent-chat.ts. Vitest: server/lib/journey.test.ts (15) plus assignments.test.ts (6) pass; typecheck and agent-native:doctor exit 0. Walked the journey in the browser with a new restaurant and nine messy messages through DeepSeek; local data reset to the sample afterwards. See the builder report for what is NOT verified (production, two real accounts in the browser, usage limits, deploy).
