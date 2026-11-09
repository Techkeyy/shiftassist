# ShiftAssist design

## Who it's for

A busy restaurant manager who builds the rota once a week, often tired and often on a phone, and staff who open their week from a link. The interface has to answer three questions at every moment: where am I, what is this, what do I do next.

## Structure

- **Product page (`/`)** explains the problem and the four steps, and includes a small interactive example that needs no account.
- **Home (`/home`)** shows one next step derived from real state, the four steps with plain status, and "Someone called in sick?".
- **Four guided steps:** Team, Rules, Week, Share. Each has its own URL, one heading, one sentence of instruction, and a fixed footer with Back and a single "Next" button that says what comes next.
- **The assistant** is optional and closed by default. Reading messages shows progress on the Rules page itself.

## Visual language: "The Pass"

A restaurant runs on paper tickets clipped to a rail at the pass. ShiftAssist borrows that, and nothing more:

- Staff messages arrive as **tickets** on a rail, quoting the staff member's own words, with the plain rule underneath. Confirming one **stamps** it.
- The week is a **ruled sheet**, with Lunch and Dinner bands so a week reads across like a real rota.
- Clicking a shift prints a **receipt** with a torn edge: why that person has it, and who else could have worked it.

Paper `#F7F2E8` and ink `#1F2A2B` in light mode, with a blue-black dark mode. Colour has jobs: yellow for "just changed" and the current step, blue for locked, tomato for problems, green for confirmed. Status is never shown by colour alone. Type is Zilla Slab for headings, Familjen Grotesk for interface text, and IBM Plex Mono for times and receipts only. No gradients, glows or decorative badges.

## Truth rules

Everything shown in the app comes from real state. Illustrations and the product page's interactive example are labelled "Example". ShiftAssist never claims to send a message: the button says "Copy message".
