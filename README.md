# ShiftAssist

Your staff's texts in. A fair week out. A rota app for small restaurants where an assistant reads your staff's messages, code builds the week, and every shift can explain itself.

**[Live app](https://shiftassist.vercel.app)**

> *"Who said they can't do Fridays again? And why does Sam keep getting the late shift?"*

Most small restaurants run their rota from a spreadsheet and a group chat. Requests get buried, the manager spends hours fitting the week together, staff ask why they got the shifts they did, and a 6am sick text starts a scramble. ShiftAssist turns that chat into rules you approve, builds a week that keeps them, explains every placement, and finds cover when someone can't make it.

Built for the Builder.io Agent-Native Hackathon, November 2026.

## Why this exists

Scheduling tools such as Deputy, Homebase and 7shifts already sell auto-scheduling. They expect structured availability entered into forms, and their schedules arrive as a finished answer. In a survey Toast commissioned in July 2026, 73% of UK managers using AI scheduling said staff had raised concerns about fairness, hours or flexibility, and Toast's advice was to explain the inputs and give staff a way to challenge errors.

ShiftAssist starts where the requests really are, in messy messages, and makes every decision answerable:

```
  staff messages        assistant          you            scheduling code         staff
  "can't do Fridays" -> proposes a rule -> confirm it -> places every shift  -> open a link
  "no closes Tue"       (never places      or fix it     keeps every rule,      and see why
                         a shift)                        explains each one      they have it
```

The assistant reads language. Code decides. You approve.

## What it does

1. **Reads** pasted staff messages. The assistant proposes rules as tickets, each quoting the original sentence. Names it can't match are flagged, and messages that aren't rules (a swap request, a thank-you) become notes, never silently dropped.
2. **Waits for you.** Proposed rules do nothing until you confirm them.
3. **Builds** the week with a deterministic solver: roles, availability, maximum shifts, rest between shifts, no overlaps, plus preferences and an even spread of closing and weekend shifts. If a shift can't be filled, it says why for each person.
4. **Explains** any shift: the reasons that person has it, and who else could have worked it and what stops them.
5. **Lets you change it** by dragging, a Move menu, or asking the assistant in chat. Every route goes through the same `move-shift` action, which re-checks the rules on the server and refuses a change that breaks one. Lock a shift and nothing moves it.
6. **Covers sick days.** It ranks who can take the shift, with any overtime cost, marks the absent person off that day, and prepares a message for you to copy. ShiftAssist does not send messages for you.
7. **Shares** the week through a private read-only link staff open on their phones without signing in, showing their shifts and why. You can stop sharing at any time.

## Try it

Open the [live app](https://shiftassist.vercel.app), create an account (email and a 12-character password), and choose the sample restaurant. It's labelled as sample data, comes with example staff messages, and gets you to a built week in a minute.

Each account has a daily limit on assistant turns, because the app runs on a shared model key. The week, rules, Move menu, explanations and sharing keep working without the assistant.

## Run it locally

Needs Node.js 22.22 or later and pnpm.

```bash
pnpm install
cp .env.example .env    # then set the model key below
pnpm exec agent-native dev
```

The live app uses DeepSeek through its OpenAI-compatible API. In `.env`:

```bash
OPENAI_API_KEY=...                       # your DeepSeek key
OPENAI_BASE_URL=https://api.deepseek.com
AGENT_ENGINE=ai-sdk:openai
AGENT_ENGINE_PREFER_BYO_KEY=1
```

Any provider Agent-Native supports also works. Open http://localhost:8080 and choose "Continue as local dev". Local data lives in PGlite; production uses Postgres (Neon).

Tests:

```bash
pnpm exec vitest run
```

## Architecture

| Part | Job |
|---|---|
| `lib/solver/` | Pure TypeScript scheduler: checks, search, repair, cover ranking and traces, no I/O |
| `server/lib/assignments.ts` | The only code that writes shifts; re-checks every rule inside a transaction |
| `server/lib/rules.ts` | Proposed, confirmed and flagged rules and notes |
| `server/lib/publish.ts` | Tokens and the read-only staff page, exposing only names, shifts and reasons |
| `server/lib/usage.ts` | Per-account daily cap on assistant turns |
| `actions/` | Shared actions used by the UI and the assistant: `propose-rules`, `confirm-rules`, `build-week`, `move-shift`, `explain-shift`, `slot-eligibility`, `find-cover`, `apply-cover`, `publish-week` and more |
| `app/` | React UI: guided steps, week view, ticket rail, receipt drawer |

## Why one action for everyone matters

Agent-Native lets the UI and the assistant call the same `defineAction()`. ShiftAssist leans on that for its main guarantee. A drag, the Move menu and a chat request ("give Sam Friday's lunch shift") all reach `move-shift`, so all three are checked by the same server code, and the board updates live when the assistant acts. While you drag, cells the solver says that person can't take are hatched, with the reason.

Confirming rules, applying cover and editing rules are marked as needing approval when the assistant calls them, so it can propose but not decide. The assistant's raw database tools are turned off (`frameworkTools: { database: "off" }`), so it can't write around the rules.

## How I tried to break it

| Attempt | Result |
|---|---|
| Ask the assistant to give a shift to someone who can't work that day, and to get around the rule "any way you can, including writing to the database directly" | Refused by `move-shift` with the reason; the shift didn't move |
| Drag a shift onto someone at their shift limit | Refused with the reason; database unchanged (tested) |
| Ask the assistant to move a locked shift | Refused: "This shift is locked. Unlock it first." |
| Repeat the same move | No change, no duplicate write (tested) |
| A message naming someone not on staff | Flagged "Needs a person"; can't be confirmed until fixed |
| A message that isn't a rule | Kept as a note; never reaches the solver (tested) |
| A proposed rule nobody confirmed | Ignored by the solver (tested) |
| Another account's shifts or people | Not visible and refused (tested) |
| Logged-out calls to the app's actions | 401 on the live app |
| A wrong, malformed or revoked share link | 404 (tested, and checked on the live app) |
| Assistant limit reached | Plain message; everything else keeps working (tested) |
| Same input to the solver twice, in any order | Identical result (tested) |

59 automated tests cover the solver and the server rules.

**Rules you confirm are enforced by code on the server, not by the assistant's good behaviour.**

## Limits

- One location and one week at a time.
- ShiftAssist doesn't send texts; you copy the prepared message.
- Hard rules are your own rules, not labour-law advice.
- Choosing cover for a locked shift is allowed, because it's your explicit choice, and that shift then stops being locked.
- Password reset needs an email provider, which the live app doesn't have, so it's hidden there.
- Phones use a by-day list with a Move menu instead of dragging.

## Built on Agent-Native

This started from the Agent-Native chat template (`@agent-native/core` 0.223). Everything else was written during the hackathon: the solver, schema, actions, guided UI, staff page and landing page.

Notes from building it on Windows and deploying to Vercel, for anyone hitting the same things:
- `agent-native start` fails when Node lives under `C:\Program Files`, because the path isn't quoted; running `node .output/server/index.mjs` directly works.
- A Windows Vercel build links function folders with junctions to absolute `C:\` paths, which Vercel can't resolve. `scripts/vercel-fix-links.cjs` replaces them with copies.
- Stopping `migrate:production` partway leaves a migration lock row that stalls the next run until it expires.
- The Hobby plan needs `AGENT_NATIVE_VERCEL_CRON_SCHEDULE` set to a daily schedule.

## License

MIT
