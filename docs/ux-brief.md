# ShiftAssist UX brief: explain, then guide

Owner's feedback on the live redesign: there is nothing explaining the product before the app; the board gives a headache; it should be directive and feel seamless; "just focus on the UX, be creative."

Director's diagnosis: the app dumps a finished grid on someone who hasn't been told what it is or what to do. Fix the structure. Keep the paper, ink, ticket and receipt identity from `docs/design-brief.md`, but comprehension now outranks every visual idea in it.

## The test everything must pass

A tired restaurant manager who has never heard of ShiftAssist can, without help:
1. In 10 seconds on the product page, say what it does and for whom.
2. At every moment in the app, answer: where am I, what is this, what do I do next.
3. Reach a filled week from nothing in under 90 seconds on the sample, by only ever clicking the one obvious button.

If a screen needs explaining, change the screen rather than adding text.

## Three surfaces

### 1. Product page: `/`, signed out

A real page that explains before asking for anything. It scrolls. Sign-in is a quiet link top right; the sign-up form is not the first thing. "Get started" opens or scrolls to the form.

1. **Hero:** "Your staff's texts in. A fair week out." One sentence: who it's for and what it does. Primary "Get started". Secondary "See how it works" scrolls down. Beside it, the existing animated Example scene.
2. **The problem, in a manager's words.** Three short familiar moments with no invented statistics: requests buried in a group chat; "why do I always get the late shift?"; a 6am sick text.
3. **How it works.** Four numbered steps, each a line of text with a small drawing: Tell us your team; Paste your staff's messages; Get a week that keeps every rule; Share it, and handle sick days.
4. **Try it right here, no account.** A small interactive Example, static data, runs in the page's own script: three people, a few shifts. Click a shift and its receipt prints beneath: "Sam has this shift because...". Click "Sam called in sick" and cover options appear, and choosing one moves the slip. Labelled Example. This is the creative centrepiece: the visitor feels the product before signing up.
5. **Why you can trust it.** Three plain statements that are true: The assistant reads messages, you confirm every rule. Scheduling is done by code that can't break a rule you confirmed. You have the final say on every shift. No "AI-powered" hype.
6. **Final call to action with the sign-up form.** Truthful note: messages are not sent for you; you copy them.

No metrics, customers or testimonials. Phone-first. Reduced motion respected.

### 2. Home: `/home`, signed in, the default landing

It answers "where do I stand and what's next" in one glance, before showing any grid. The name "Week" is the working sheet; this is the summary.

**New account:** "Let's build your first week." Two big choices with one line each: "See it with a sample restaurant (1 minute)" as the primary, and "Set up my own restaurant". Include a short "What happens next" of the four steps.

**Existing week:**
- Title: restaurant name, week.
- One large **Next step card**: a single sentence and a single button. It is always exactly one action, derived from real state:
  - rules waiting: "2 staff messages need your check." Button: Check them
  - no schedule: "Your rules are ready. Build the week." Button: Build my week
  - open shifts: "1 shift has nobody on it." Button: Fix it
  - built and not shared: "Your week is ready. Share it with your staff." Button: Share
  - shared: "Your week is live. Staff can see it now." Button: See the week. Plus "Someone called in sick?" as a second clear action.
- **The four steps** as a checklist with plain status: Team (8 people, 35 shifts), Rules (6 in use, 2 waiting), Week (34 of 35 filled), Share (not shared). Each is clickable.
- A small read-only **preview of the week** with "Open the week".
- "Someone called in sick?" always visible here once a week exists: the most urgent real-world task must be one click from home.

### 3. The guided app: one job per screen

Replace the all-in-one board with four steps, each its own screen with its own URL, so Back works and refresh keeps your place: `/team`, `/rules`, `/week`, `/share`. Keep existing actions; reuse components.

Every step screen has the same skeleton:
- **Top bar:** logo links to Home; numbered steps "1 Team, 2 Rules, 3 Week, 4 Share" with a check on finished ones and the current one clearly marked; account menu.
- **Heading saying the job in plain words,** and one sentence: what this is and what to do.
- **The work area.**
- **A fixed footer** with Back and one primary "Next: ..." button, which says what comes next. Disabled only with a stated reason: "Check the 2 waiting messages first", plus a "Skip for now" where safe.

**Step 1, Team:** "Who works here, and which shifts do you need?" The setup form, in plain language; one person per row. Sample users see their sample team and just press Next.

**Step 2, Rules:** "Tell us what your staff asked for." Large paste box. If the sample: one big "Use the sample messages" button. While reading: visible progress on the page itself ("Reading 3 messages..."), with tickets clipping on as they arrive. The user must not have to look at chat at all. Then: "We found 3 things. Check each one." Each ticket has its Confirm in plain sight, with "Confirm all" as primary. Notes and flagged cards say exactly what to do. Footer: "Next: Build my week".

**Step 3, Week:** first arrival is a moment. Press "Build my week": short real progress, then result: "Everyone is placed. 35 of 35 shifts filled, and every rule kept." The view is simplified by default:
- One row per person, one column per day, each slip reads like words: "Lunch 10-4". Plain and airy. Lunch and dinner bands stay subtle.
- **Tally marks hidden by default,** behind a "Show fairness" toggle. Replace "Above avg" clutter with one plain summary line, such as "Closes are shared fairly: everyone has 2 or 3", computed from real data.
- **Legend line:** what a slip, a lock and a yellow mark mean.
- **First-visit coach marks,** three short steps: "Each row is a person." "Click any shift to see why that person has it." "Drag it, or use Move, to change it. We stop anything that breaks a rule." Dismissable, remembered, reopenable from "How this works".
- **Click a shift:** drawer leads with the answer, then three clear buttons: Move to someone else; Someone can't make it; Lock this shift. "Who else" sits under a collapsed "See who else could work it".

Footer: "Next: Share with staff". Phones: by-day list.

**Step 4, Share:** "Send your staff their week." One big Publish button, then the link with Copy, and a preview of what staff will see. "Done" leads Home.

### The assistant

It's a helper, never required. Closed by default, always reachable through a labelled "Ask the assistant" button, not an unlabeled icon. Message reading happens with progress on the Rules screen. Suggested prompts are specific to the screen, like "Give Sam Friday's lunch shift" and "Who has the most closes?". A live board change while chat is open stays, since it's the differentiator, and the demo shows it.

## Rules of the words

Plain words only: no "slip", "tally", "docket", "engine", "panel", "agent". "Sheet" is out too: say "your week". No raw times like "10:00-16:00" in casual lists; prefer "10am to 4pm" with a compact "10-4" only on narrow slips. Always use the person's name. Never more than one primary button per screen. No em or en dashes.

## Truth rules, unchanged

Everything shown in the app comes from real state. Illustrations and the page's interactive Example are labelled Example. Copy message never says Send.
