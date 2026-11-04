# Agent-Native Hackathon: idea research

Run date: 2026-11-04. Method: `idea-research` skill and scorecard.

**Recommendation: Fair Shift, a staff rota where every placement can be questioned.**

> Managers paste the week's messy texts, the agent turns them into editable rules, a solver builds the rota, and every shift can answer "why me?"

Status: recommended, not locked. It needs the framework kill test (section 8) and five real managers' reactions.

---

## 1. Gates

| Gate | As written | Status |
| --- | --- | --- |
| Deadline | Mon Nov 9, 11:59 PM PT (Nov 10, 07:59 UTC) | PT controls. An older search snippet said Nov 2; the current rules say Nov 9 |
| Eligibility | Worldwide, 18+, subject to sanctions law | Confirm you qualify when submitting |
| Team | Teams allowed, no stated size | Solo OK |
| Required tech | Functional app built with Agent-Native | Design goal |
| Originality | New work from Oct 27; disclose templates and pre-existing work and what changed | Disclose the template |
| Demo | Public Clips video of the real app, viewable without login | Required. No length stated |
| Submission | Form on builder.io/hackathon/submit, **then confirm receipt** | A clip alone does not count |
| Repo or live deploy | Encouraged, not required | Do both anyway; judges need an accessible demo |
| Number of entries | No stated limit | Not needed |
| Disqualifiers | Failed verification, plagiarism, fabricated demos | Never fake the demo data flow |
| Prize tax | Non-US winners may face up to 30% US withholding unless a treaty applies; W-8BEN needed | Withheld from the prize |

## 2. Rubric to effort

| Criterion | Weight | What earns it here | Share of effort |
| --- | --- | --- | --- |
| Usefulness and Execution | 40 | A manager gets a usable rota and survives a call-out, end to end | 40% |
| Creativity and Design | 20 | The board is the product; "why me?" is a distinct interaction | 20% |
| Innovation | 20 | Agent handles messy language and explanations; the solver guarantees the rules | 20% |
| Cleverness, Use of Agent-Native | 20 | Same actions from board and chat; pinned shifts and selection in shared state | 20% |

Prizes: $5,000, $2,500, $1,500, $750, $250. Recognition categories carry no cash and do not change scoring.

## 3. What Agent-Native already ships

**Done, do not rebuild:** `defineAction()` across UI, agent, HTTP, MCP, A2A and CLI; agent chat; auth and orgs; skills and memory; automations; agent teams; Postgres (PGlite locally); `view-screen`, `navigation` and `selection` state; `sendToAgentChat()`, which lets a UI control start an agent turn.

**Official templates:** analytics, assets, brain, calendar, chat, clips, community, content, crm, design, dispatch, factory, forms, mail, plan, slides, tasks, videos.

**Community templates:** account expert, account tiering, call follow-up drafter, churn early warning, demo clip library, LinkedIn prospect tracker, LinkedIn signal watch, outbound in your voice, win-loss memo. These lean heavily to sales and go-to-market.

**Stated thesis (Builder blog):** chat-only agents give users no good way to correct a non-deterministic system, and bolted-on AI buttons leave no room for review. Fair Shift demonstrates the correction half directly.

**Whitespace:** no official or community template handles frontline work or a constraint-bound grid.

## 4. Field scan

Public repos on Nov 4 (a partial sample; many teams have not published):

- **Desk and copilot apps:** bid desk, ProposalPilot, Verdict (bug bounty inbox), Dike Desk (legal citations), EvalDesk, compliance workbench, HackHunt
- **Money and consumer:** Hisaab (expense splitting), Lapse (subscriptions), Scam Shield, Miseops (kitchen costing)
- **Developer and review:** a11y fixer, Architect Refuse, release workbench, RelayReview, Actor Forge, Muscle Memory
- **Content:** SignalForge

Dominant shape: *agent reviews a document or inbox, human approves a list.* It is the obvious reading of the brief, so assume it is crowded. A live constraint board is a different shape.

Rival checks: repo searches for shift, rota and roster with Agent-Native found no entry. That covers public repos only, so it does not show nobody is building this. Closest neighbours: Miseops (restaurant, but costing) and an Agent-Native clinic app (appointments, not staff). ShiftIQ on lablab.ai is a scheduling assistant from another hackathon.

Hearth's README claims first place at an "Agent Native Hackathon" (repo created June 2026). That cannot be this event; organizer unverified. Its shape: it lives where people already coordinate, and turns messages into action. Useful pattern, and it supports starting from pasted texts.

## 5. Demand evidence

| Evidence | Source | Strength |
| --- | --- | --- |
| People pay: Deputy core at $6.50 per user per month with auto-scheduling; Homebase locks AI scheduling to a higher tier | Roundup and Capterra pages; confirm on vendor sites | Strong signal of payment |
| Named category with several funded vendors: 7shifts, Deputy, Homebase, Legion, Harri | Multiple | Strong |
| 73% of AI scheduling users said staff raised concerns about fairness, hours or flexibility; Toast advises explaining the inputs, visible review, and a way to challenge errors | Toast-commissioned Pollfish survey, July 2026, 400 UK managers, 227 active AI users; AI-scheduling subgroup size unpublished; manager reports, not employee accounts | **Best evidence for the angle.** Vendor-commissioned |
| 3.7 hours a week building and managing schedules (Harri, via QSR); 3.14 hours on spreadsheets (TimeForge) | Vendor figures | Medium; vendors sell the cure |
| Deputy auto-scheduling needs weeks of history to perform well | One hands-on review | Weak, single source. It supports "works on day one from texts" |

**Gap in this evidence:** searches found no independent practitioner complaints (no Reddit threads surfaced). The pain is well attested by sellers, not yet by managers. Treat this as the top thing to check by talking to five real managers.

## 6. Candidates

| Dimension | **Fair Shift** (rota) | Show-Once Cleaner (CSV) | Postmortem Desk | Denial Appeal |
| --- | --- | --- | --- | --- |
| Pain frequency | High, weekly | Medium | Low, per incident | Low per person |
| Pain severity | Medium to high | Medium | Medium | Very high |
| Evidence of demand | High | High (Flatfile, OneSchema) | High (incident.io, Rootly) | High (Counterforce, Claimable) |
| Competition density here | Low in visible field | Medium; Muscle Memory shares the "show once" hook | Medium; release and review tools nearby | Medium; one lookalike repo |
| Structural difference | High: live grid, guaranteed rules | Medium | Low: review-a-document shape | Low: review-a-document shape |
| Agent-Native showcase | High | High | Medium | Medium |
| Assumption risk | Low to medium | Low | Low | **High**: medical and legal accuracy |
| 90-second comprehension | **High**, seen with sound off | High | Medium | Medium |
| Team feasibility in days | Medium to high | High | High | Medium |
| Life after the event | Medium to high; strong incumbents | Medium | Medium | Medium |

**Why the rest lost:**

- **Show-Once Cleaner** (runner-up): edit one cell, the agent proposes a rule for similar rows. The easiest build and a great interaction, but a dry problem with a less memorable demo, and "show once" is already in the visible field. **Switch here if the board is not working by Nov 8 00:00 UTC**, because its grid and diff UI can be reused.
- **Postmortem Desk:** the same document-review shape as most entries, and it needs real logs to impress.
- **Denial Appeal:** serious pain, but wrong advice causes real harm, and judges can't assess accuracy in 90 seconds.
- **Crypto or evidence ideas drawn from your earlier projects:** they would drag your last architecture into a rubric that rewards everyday usefulness.

## 7. The chosen idea

**User:** the owner or manager of an independent restaurant, café or small clinic with 10 to 30 staff, currently running on a spreadsheet and a group chat.

**Mechanic, angle, wedge:**

- **Mechanic:** agent plus scheduling board. It converges; incumbents have it.
- **Angle:** fairness you can question, on day one, from the texts a manager already has. No payroll integration and no weeks of history.
- **Wedge:** the split itself. The LLM never places a shift. The agent only writes rules; a deterministic solver places shifts and checks every change, so hard rules can't be silently broken and each placement has a real, traceable reason. A rival would have to rebuild the core rather than restyle it.

Everyone will build "agent reviews, human approves"; this is the one where a manager can drag a shift and have rules enforced by code, and copying it means building a solver and an explanation trace, not a prompt.

**Smallest complete loop:**

```
paste messy texts -> editable rule cards -> solver fills the board
-> manager drags and pins a shift -> agent repairs the rest and shows what moved
-> "Maria called in sick" -> ranked cover options with reasons -> approve -> message draft
```

**Ninety-second demo:**

1. 0:00: A manager pastes real-looking texts: "can't do closes till finals end", "no doubles for Sam".
2. 0:15: Rule cards appear beside the board; the manager corrects one by hand.
3. 0:25: The week fills in, with a fairness strip showing closes and weekends per person.
4. 0:40: The manager drags a shift and pins it; the agent repairs around it, and changed shifts glow.
5. 1:00: A staff member asks "why do I have three closes?" One click shows the rule trace and the alternative.
6. 1:15: "Maria called in sick" in chat. Ranked options appear on the board, with overtime cost. Approve, and a draft message is ready.

**Agent-Native use that matters (delete test: remove any of these and the product breaks):**

| Piece | Job |
| --- | --- |
| Shared actions (`add-rule`, `solve-week`, `move-shift`, `pin-shift`, `find-cover`, `explain-shift`) | Board and chat call identical code, and the solver validates both |
| `selection` and `view-screen` | "Why this one?" and "swap these" work on what's selected |
| `sendToAgentChat()` | The "Why?" button on a shift starts an agent turn with its trace |
| Live sync | Agent changes land on the board as they happen |
| Memory and skills | Standing rules persist per location |
| Automation (stretch) | Publish reminder or Sunday coverage check |

**Scope:**

- **Must exist:** seeded demo location, paste-to-rules, rule cards, solver with hard and soft rules, board with drag and pin, repair with visible diff, why-trace, call-out flow, deployed URL.
- **Removable:** fairness history across weeks, role-based logins.
- **Polish:** glow animation, phone view for the "Why?" panel, CSV export.
- **Future (README only):** real SMS sending, POS demand forecasts, payroll, labour-law packs, staff logins and swaps.

Don't claim legal compliance. Hard rules are the manager's own, not statutory advice. Real message sending is not in the build, so the demo must say "draft".

## 8. Load-bearing assumption and kill test

**Bet:** an Agent-Native app can run on this PC and show agent-made changes on a custom board live, using the same action as a drag.

**Result on 2026-11-04: not passed, not failed.** Node 24.14 and pnpm 11.19 meet the documented requirements. `npx` hung twice without creating files. `pnpm dlx` scaffolded the chat template in about 3.5 minutes. `pnpm install` was cut off by my 400-second limit at about 463 packages of 942 resolved, so `pnpm dev` could not find `agent-native` and the app never booted. The PC had 796 MB free RAM of 16 GB and 6 GB free disk during the run, which is the likely cause but is unproven. Free up memory and disk first, or develop on a cloud machine.

**Pass condition (cap: half a day):**

1. The chat template boots locally.
2. Add a `move-shift` action and a minimal grid.
3. Asking in chat moves a cell without a manual refresh, and dragging the cell calls the same action.
4. Deploy it once with a hosted Postgres and call it from a phone.

**Known framework risks from open issues:**

- A workspace gateway issue on Windows when only `pnpm.cmd` is on PATH. Using `--standalone` should avoid it (not yet verified).
- A 40-second hosted soft timeout on Cloud Run. Keep the solver fast and in its own action.
- Reports of duplicated tool runs and failed approvals after approved calls. Make board actions idempotent.
- A report of the agent wedging on raw `db-query` spirals. Steer it to the named actions in `AGENTS.md`.

**Second check:** show the 90-second mock-up or text to five real managers or shift workers. If they say fairness questions don't matter to them, lead with call-outs instead; the build is the same.

## 9. Builder reality

| Date | Your other commitment |
| --- | --- |
| Nov 6, 04:00 UTC | Portaldot / OneScan |
| Nov 7, 18:29 UTC | Flip the Switch / Firedrill |
| **Nov 9, 22:00 UTC** | **Vibeathon / Checker** |
| **Nov 10, 07:59 UTC** | **This hackathon** |
| Nov 14, 23:59 UTC | NEAR / SecondEyes |

This is the fifth live entry. The realistic window is after Nov 7, and it overlaps with Checker's final two days. Without moving something, the plan has about 2.5 days at best. Decide what to drop before starting; this idea needs at least 2 clear days plus the half-day test.

**Reusable from you:** the master director process, `design-skill`, and the demo-video and README skills. No product code carries over, and that's fine.

## 10. Decision record

- **Chosen:** Fair Shift, a rota whose placements can be questioned, with an agent for language and a solver for guarantees.
- **Beat the runner-up because:** it is instantly understood with the sound off, sits outside the dominant review-a-list shape, and has survey evidence for its angle. The CSV cleaner is easier but less memorable.
- **Biggest remaining risk:** build time against your four other entries, followed by the Windows toolchain.
- **Change plan if:** the kill test fails by Nov 8 00:00 UTC (switch to Show-Once Cleaner or skip), or managers shrug at fairness (lead with call-outs).

## Sources

- [Hackathon page](https://www.builder.io/hackathon), [Official rules](https://www.builder.io/hackathon/rules)
- [Agent-Native docs](https://www.agent-native.com/docs/), [Key concepts](https://www.agent-native.com/docs/key-concepts/), [Context awareness](https://www.agent-native.com/docs/context-awareness/), [Create with an agent](https://www.agent-native.com/docs/create-with-an-agent/)
- [Repository](https://github.com/BuilderIO/agent-native), [Builder blog on agent-native apps](https://builder.io/blog/agent-native-apps), [RuntimeWire on the beta](https://runtimewire.com/article/builder-agent-native-beta-framework-agentic-apps)
- [Toast survey via Onrec](https://www.onrec.com/node/129259), [QSR on AI scheduling](https://www.qsrmagazine.com/story/why-ai-scheduling-has-become-a-restaurant-necessity/), [FSR on AI scheduling](https://www.fsrmagazine.com/feature/ai-takes-on-scheduling-in-restaurants/)
- [Capterra: Deputy vs Homebase](https://www.capterra.com/resources/deputy-vs-homebase/), [Dupple review of Deputy](https://dupple.com/reviews/deputy), [Homebase on 7shifts alternatives](https://wf.joinhomebase.com/blog/7shifts-alternatives)
- [TimeForge template](https://timeforge.com/resources/restaurant-work-schedule-template/), [ShiftIQ on lablab.ai](https://lablab.ai/submissions/jpy51sciwncoxg8plo7sfwe5), [Hearth repo](https://github.com/Ansh-Karnwal/Hearth)
