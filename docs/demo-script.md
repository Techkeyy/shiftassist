# ShiftAssist demo script (about 2:20)

Record with Builder's Clips, on the live app, in one browser window at about 1440 px wide. Light mode reads best on video. Speak slowly. About 320 spoken words.

**The one sentence the video is built around:**
> "The assistant can suggest anything. It can't break a rule you confirmed."

## Before the first take

1. **Account:** use a fresh account made for the demo, so nothing old shows. Sign in once before recording.
2. **Sample:** on Home, choose "See it with a sample restaurant". Go to Rules and press "Use the sample messages". Wait for the tickets, but do NOT confirm them yet. You'll confirm on camera.
3. **Tabs, in order:**
   - Tab A: https://shiftassist.vercel.app/ in a private window (signed out), scrolled to the top.
   - Tab B: https://shiftassist.vercel.app/rules (signed in), tickets waiting.
   - Tab C: your phone, or a narrow private window, ready to open the staff link.
4. **Check the sample:** open Week once and note one shift that a named person can't take (for example, Maya on Friday if her "can't do Fridays" rule is in use). Also pick one shift that is allowed for someone: drag it slightly and look for an outlined cell, not a hatched one. You'll use both in Scene 4.
5. **Assistant panel:** open it once so it isn't loading for the first time on camera, then close it.
6. **Ruins a take:** pages still loading, an expired session, or a toast covering the board. If anything unexpected appears, stop and redo the scene.

## Scene 1 · 0:00 to 0:20 · Tab A, product page

**On screen:** start on the hero. Slowly scroll to "You know this week already."

**Say**
> "If you run a small restaurant, your rota lives in a group chat. Who can't do Fridays. Who keeps getting the late shift. The 6am sick text. ShiftAssist turns those messages into a fair week, and it can explain every shift."

## Scene 2 · 0:20 to 0:45 · Tab B, Rules step

**On screen:**
1. Hold on the tickets for two seconds.
2. Point at one quote, then at the plain rule under it.
3. Press "Confirm all", and let the stamps land.

**Say**
> "I pasted my staff's messages. The assistant turned each one into a ticket: their words on top, the rule underneath. Names it couldn't match are flagged. Nothing is used until I confirm it."

## Scene 3 · 0:45 to 1:05 · Week step

**On screen:**
1. Press the footer's Next to reach Week. If you see "Build the week again", press it.
2. Read the result line aloud.
3. Click one shift and let the receipt open.

**Say**
> "Code builds the week, not the AI, so it can never place someone against a confirmed rule. Click any shift and it tells you why that person has it, and who else could have worked it."

## Scene 4 · 1:05 to 1:45 · Week step, assistant open. THE CLIMAX, longest scene

**On screen:**
1. Click "Ask the assistant".
2. Type a request for the ALLOWED move you checked, for example `Give Sam the Friday lunch shift.` Send it, then move the mouse away from the board and watch it change on its own.
3. Type the request that BREAKS a rule, for example `Give Maya the Friday dinner shift.` Send it.
4. When the refusal appears, stop moving the mouse. Read the line below slowly, then stay silent for one full second.

**Say**
> "The assistant and the board use the same actions. I ask for a change, and the week updates live."
>
> "Now, on purpose, I'll ask for something that breaks a rule."
>
> (after the refusal, slowly) "The assistant can suggest anything. It can't break a rule you confirmed."

**Why this scene gets the most time:** the refusal is the moment other entries can't show. It's an intentional test, so say "on purpose" every time.

## Scene 5 · 1:45 to 2:05 · sick day

**On screen:**
1. Click a shift, then press the "can't make it" button for that person.
2. Choose the top option.
3. Show the prepared message, then press "Copy message".

**Say**
> "Someone calls in sick. ShiftAssist shows who can cover without breaking a rule, and any overtime. I pick one, and it writes the message for me to send."

## Scene 6 · 2:05 to 2:20 · Share, then Tab C

**On screen:**
1. Press the footer's Next to Share, press Publish, press Copy link.
2. Open the link on Tab C and tap a name.

**Say**
> "Staff get a link on their phone: their shifts, and why. No account needed. ShiftAssist, built on Agent-Native."

Stop on the last word. No outro.

## Do not claim

- It does not send texts or messages. You copy them.
- It is not labour-law compliance; the rules are yours.
- One restaurant and one week at a time.
- Don't call it "fully autonomous": you approve every rule and cover.
- Don't name customers, users or numbers; there aren't any.

## Fact check before uploading

| Spoken claim | Where it's proven |
|---|---|
| Messages become tickets, flagged names, nothing used until confirmed | Rules step; `server/lib/journey.test.ts` "proposed rules never reach the solver" |
| Code builds the week and can't break a confirmed rule | `lib/solver`, `server/lib/assignments.ts`; refusal shown in Scene 4 |
| Assistant and board share actions; live update | `move-shift` action; Scene 4 |
| Cover respects rules and shows overtime | `find-cover`, `apply-cover`; Scene 5 |
| Staff link needs no account | `/s/<token>`, opened signed out in Scene 6 |

After recording: make the Clip public, check it plays when signed out, and paste the link into the README's link bar and the submission form. Then confirm the submission was received.
