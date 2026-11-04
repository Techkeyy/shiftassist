# ShiftAssist design brief: "The Pass"

Owner's order: apply the design skill, use SVGs, add reactive components, be creative. Owner has no reference samples, so the director set this direction. Authoritative skill files: `Desktop/skill/design-skill/SKILL.md`, `references/design-system.md`, `companions/unslop/SKILL.md`, `companions/unslop/references/signs.md`.

## Answers the skill requires

- **Does:** turns staff messages into a fair week whose every shift can explain itself.
- **Who:** a busy, tired restaurant manager, weekly, often on a phone. Staff open the shared link once a week.
- **Primary action by state:** set up, read messages, build week, share.
- **Magic moment:** messy texts become tickets, the week fills, and a shift answers "why me?"
- **Three true words:** calm, legible, fair.
- **Trust comes from:** visible rules, reasons, and refusals that come from code.

## Concept

A restaurant runs on paper tickets clipped to a rail at the pass. ShiftAssist is that rail. Staff messages become **tickets**. A confirmed rule gets **stamped**. The week is a **ruled sheet**. Any shift can print its **receipt** explaining why. Replace the logo and this interface makes no sense for another product: that is the substitution test, and it must pass.

Do not overdo it: no skeuomorphic textures, wood, steel photos or fake paper noise. Flat drawn shapes, crisp SVG, real type. Ordinary labels stay plain English; no kitchen slang a clinic manager couldn't read.

## Visual system

**Light by default ("the sheet")**: paper `#F7F2E8`, raised paper `#FFFDF7`, ink `#1F2A2B`, secondary ink `#55605F`, ruled line `#1F2A2B` at 12 to 16%.
**Dark ("after close")**: blue-black `#14191B`, raised `#1C2326`, paper-coloured text. Keep it working on all screens.

Colour has jobs. Compute AA contrast for every pair and report it.
- Primary action: ink fill with paper text.
- Docket yellow `#F2C230`: "just changed" and the current step. Never for text on paper.
- Pin blue `#28598A`: locked.
- Tomato `#B93A26`: problems and refusals only, always with an icon and words.
- Herb green `#3C7A57`: a confirmed stamp and "allowed" only.

**Type** (self-hosted through `@fontsource`; you may add exactly these three packages):
- Zilla Slab 500/600: restaurant name, section titles, stamp text.
- Familjen Grotesk variable: all ordinary UI and prose.
- IBM Plex Mono 400/500: times, counts, ticket numbers and receipt lines only, with tabular figures. Never for sentences of prose.
Minimum 14px for product text. No uppercase tracked labels, except the stamp.

**Shape:** tickets have square corners and an SVG perforated or zigzag edge. Buttons 6px radius. Grid rules, not cards in cards. No gradients, glows, blurs, glass, sparkles or decorative pills.

**Own mark:** replace the framework logo with a flat one-colour SVG mark, a ticket held by a clip, plus the wordmark `ShiftAssist`.

## Signature components, in priority order

Everything below shows real data. Cut from the bottom up if time runs short; items 1 to 4 must ship.

1. **The week sheet, with live rules while dragging.** Staff down the side, days across, ruled like a paper rota. Each shift is a compact slip with mono times and a tiny SVG day-arc showing where it sits in the day (morning low on the arc, close near the moon). While a shift is dragged or selected, every other person's cell in that column reacts: allowed cells show a soft outline, and blocked cells show SVG diagonal hatching with the reason on hover or focus. Data comes from a real read-only action (`slot-eligibility`) calling the engine, cached per slot and prefetched on pointer down. If it hasn't loaded yet, show nothing rather than guess. Hovering a person dims others to reveal that person's week.

2. **The board reacts visibly when anything moves.** When a shift changes hands, from a drag or from the agent, the slip travels from old cell to new with a FLIP transform (250 ms, one ease-out curve) and then holds a docket-yellow marker until the next action. A repaired shift does the same. While the agent runs, a thin strip on the sheet says what it is doing. This is the demo's visual proof that board and chat share one action.

3. **Why receipt.** Clicking a shift prints a till-style receipt that slides from under the sheet, with an SVG zigzag torn edge and mono lines: shift, person, each true reason, the person's count against team average, then "Who else" with each name struck through by an SVG line and the blocking reason. "Ask the assistant" sits at the bottom. Same receipt component on the public staff page, phone-first, showing only what the public data allows.

4. **Tickets and the rubber stamp.** Pasting messages shows an SVG rail with tickets clipping on as rule cards arrive (real cards only), each with its source sentence in the staff member's own words, and the plain rule below it. Confirm stamps it with an SVG `CONFIRMED` stamp (rotated about 4 degrees, press-in 180 ms); notes that aren't rules are an unstamped ticket reading "Needs your eye". Flagged cards show a clear problem marker. Confirm all stamps them in a short stagger.

5. **The tally: fairness at a glance.** For each person, closes and weekend shifts drawn as SVG tally marks (four strokes and a slash), plus a thin line for the team average. Strokes animate on change. Values come from engine output only. This replaces any table or generic bar chart.

6. **Sick day flow.** Selected shift offers "Someone can't make it". Options appear as ranked tickets: name, plain reasons, overtime cost in mono. Choosing one moves the slip (item 2) and shows the prepared message on a ticket with Copy message. If nobody can cover, show that honestly with reasons.

7. **Step rail.** Compact rail at the top: Staff and shifts, Rules, Week, Share, with clips marking done and current. It always offers the one next action. Remove the numbered card stack and the long scrolling form page. Board is the hero: rules and paste slide in as a panel beside the sheet, rather than pushing it down the page.

8. **Landing page.** Asymmetric split. Left: the honest sentence and form. Right: one inline SVG scene labelled "Example": three message bubbles become tickets, which clip to a rail and slots fill on a small sheet. It plays once on load (under 4 s) and rests on the finished frame. Reduced motion shows the finished frame immediately. No fake numbers, logos or testimonials.

9. **Empty and loading states.** Line-drawn SVG: an empty rail with open clips ("No rules yet. Paste your staff's messages."). Skeletons shaped like the sheet, not generic bars.

10. **Chat panel.** Style through framework tokens to match paper and ink. Don't fork the component.

## Truth rules

Illustrations are labelled "Example" and can never pass for a result. No fake metrics. Stamps, tallies, hatching and reasons come only from real state. Function first: don't change action behaviour except adding the read-only `slot-eligibility` action. Copy has no em or en dashes in visible strings. Drag always has the "Move to..." alternative; on phones the sheet becomes a by-day list. Keyboard reachable, visible focus, status not by colour alone. Motion uses transform and opacity only, 150 to 300 ms, one ease-out curve, and `prefers-reduced-motion` shows the end state immediately.

## Director's review criteria

Reject if: substitution test fails, it still reads as the template, any slop sign from `signs.md` remains, primary action is unclear at any step, text under 14px is needed to act, or anything is faked.
