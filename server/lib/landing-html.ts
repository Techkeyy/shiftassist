/**
 * The signed-out product page. The toolkit's auth page cannot be restyled, so this is a
 * self-contained document passed to createToolkitAuthPlugin({ loginHtml }).
 *
 * It explains the product first and asks for an account last: hero, the problem, how it works,
 * a no-account interactive Example (plain inline script, static made-up data, labelled Example),
 * why you can trust it, and the sign-up form.
 *
 * Endpoints (checked against @agent-native/core/server/auth.js):
 *   POST /_agent-native/auth/register  { email, password }   -> { ok: true } | { error }
 *   POST /_agent-native/auth/login     { email, password }   -> session cookie | { error }
 *   POST /_agent-native/auth/ba/request-password-reset { email }
 * Register does not sign in, so the page logs in right after, as the toolkit page does.
 * The password minimum is 12 characters. No metrics, quotes or customers appear here.
 *
 * Inline scripts: the sign-in form has always run as an inline script on this page and no
 * Content-Security-Policy header is set by this app, so the Example script runs the same way.
 */
export const PASSWORD_MIN = 12;

const CLIP =
  '<svg class="clip" width="16" height="22" viewBox="0 0 16 22" aria-hidden="true"><path d="M2 1.5h12v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 9.5z" fill="currentColor"/><rect x="6.2" y="3.8" width="3.6" height="3.4" rx=".7" fill="var(--card)"/><path d="M8 11v9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
const ZIG = '<svg class="zig" viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden="true"><rect width="100%" height="10" fill="url(#z)"/></svg>';

export function buildLandingHtml(opts: { forgotPassword: boolean }): string {
  const forgot = opts.forgotPassword;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ShiftAssist</title>
<meta name="description" content="Paste your staff's messages. ShiftAssist builds a week that keeps their rules, and tells you why every shift went to the person it did.">
<style>
@font-face{font-family:"Zilla Slab";font-weight:600;font-style:normal;font-display:swap;src:url(/fonts/zilla-slab-latin-600-normal.woff2) format("woff2")}
@font-face{font-family:"Zilla Slab";font-weight:500;font-style:normal;font-display:swap;src:url(/fonts/zilla-slab-latin-500-normal.woff2) format("woff2")}
@font-face{font-family:"Familjen Grotesk";font-weight:400 700;font-style:normal;font-display:swap;src:url(/fonts/familjen-grotesk-latin-wght-normal.woff2) format("woff2")}
@font-face{font-family:"IBM Plex Mono";font-weight:400;font-style:normal;font-display:swap;src:url(/fonts/ibm-plex-mono-latin-400-normal.woff2) format("woff2")}
:root{color-scheme:light dark;--bg:#F7F2E8;--card:#FFFDF7;--fg:#1F2A2B;--muted:#55605F;--rule-strong:#7D827E;--primary:#1F2A2B;--primary-fg:#F7F2E8;--ring:#28598A;--problem:#B93A26;--ok:#2B6B49;--chip:#EFE8D8;--yellow:#F2C230;--ease:cubic-bezier(.22,.61,.36,1);
--display:"Zilla Slab",Georgia,serif;--ui:"Familjen Grotesk","Segoe UI",system-ui,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#14191B;--card:#1C2326;--fg:#F2EDE0;--muted:#AAB5B0;--rule-strong:#6F7C7E;--primary:#F2EDE0;--primary-fg:#14191B;--ring:#8DB7E6;--problem:#F08A78;--ok:#7DC59C;--chip:#232C2F;--yellow:#E0B22A}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--fg);font:1rem/1.5 var(--ui)}
.wrap{max-width:1160px;margin:0 auto;padding:0 16px}
.top{display:flex;align-items:center;justify-content:space-between;padding:16px 0}
.brand{display:flex;align-items:center;gap:8px;font-family:var(--display);font-weight:600;font-size:1.25rem;color:var(--fg)}
.brand svg{display:block}
.quiet{color:var(--fg);text-decoration:underline;text-underline-offset:3px;font-size:.9375rem;padding:10px 4px;min-height:44px;display:inline-flex;align-items:center}
h1,h2,h3{font-family:var(--display);font-weight:600;letter-spacing:0;margin:0}
h1{margin:0 0 12px;font-size:clamp(2.125rem,6.6vw,3.5rem);line-height:1.08}
h2{font-size:clamp(1.625rem,4.4vw,2.25rem);line-height:1.15;margin-bottom:8px}
h3{font-size:1.1875rem;line-height:1.25}
.lead{margin:0 0 20px;color:var(--muted);max-width:32em;font-size:1.125rem}
.sec{padding:52px 0;border-top:1px dashed var(--rule-strong)}
.sec .sub{margin:0 0 24px;color:var(--muted);max-width:40em;font-size:1.0625rem}
.ctas{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 22px;border-radius:6px;font:inherit;font-weight:700;font-size:1.0625rem;cursor:pointer;text-decoration:none;border:1px solid var(--primary)}
.btn.main{background:var(--primary);color:var(--primary-fg)}
.btn.ghost{background:transparent;color:var(--fg);border-color:var(--rule-strong)}
.btn.small{min-height:44px;padding:0 14px;font-size:.9375rem}
.panel{background:var(--card);border:1px solid var(--rule-strong);padding:16px;max-width:30rem}
.tabs{display:flex;gap:8px;margin-bottom:8px}
.tabs button{flex:1;min-height:44px;border:1px solid var(--rule-strong);background:transparent;color:var(--fg);border-radius:6px;font:inherit;font-weight:600;cursor:pointer}
.tabs button[aria-selected="true"]{background:var(--primary);color:var(--primary-fg);border-color:var(--primary)}
label{display:block;font-size:.9375rem;font-weight:600;margin:12px 0 4px}
input{width:100%;min-height:44px;padding:8px 10px;border:1px solid var(--rule-strong);border-radius:6px;background:var(--bg);color:var(--fg);font:inherit}
:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
.hint{font-size:.9375rem;color:var(--muted);margin:4px 0 0}
.go{margin-top:16px;width:100%;min-height:48px;border:1px solid var(--primary);border-radius:6px;background:var(--primary);color:var(--primary-fg);font:inherit;font-weight:700;font-size:1.0625rem;cursor:pointer}
.go:disabled{opacity:.6;cursor:wait}
.link{background:none;border:0;padding:8px 0;color:var(--fg);text-decoration:underline;text-underline-offset:3px;font:inherit;cursor:pointer;min-height:44px}
.msg{margin:12px 0 0;font-size:.9375rem;min-height:1.4em}
.msg.err{color:var(--problem)}.msg.ok{color:var(--ok)}
[hidden]{display:none!important}
.tag{display:inline-block;border:1px solid var(--rule-strong);padding:0 .5rem;font-size:.875rem;font-weight:600;background:var(--card)}
.hero{display:grid;gap:32px;padding:12px 0 56px}
.scene{position:relative;margin:0}
.scene figcaption{margin-bottom:10px}
.scene .note{margin:14px 0 0;font-size:.9375rem;color:var(--muted)}
.rail{height:8px;border-radius:4px;background:var(--fg)}
.tk{list-style:none;margin:0;padding:0}
.cell{position:relative;display:grid;margin-top:22px}
.cell>*{grid-area:1/1}
.bub{align-self:center;justify-self:start;max-width:92%;border:1.5px solid var(--fg);border-radius:14px 14px 14px 3px;background:var(--card);padding:10px 14px;font-size:1rem;opacity:0}
.bub b{display:block;font-size:.875rem;color:var(--muted);font-weight:600}
.ticket{position:relative;background:var(--card);border:1px solid var(--rule-strong);border-bottom:0;padding:14px 14px 18px}
.ticket .zig,.rc .zig{position:absolute;left:-1px;bottom:-9px;width:calc(100% + 2px);height:10px;color:var(--rule-strong)}
.clip{position:absolute;top:-12px;left:20px;color:var(--fg)}
.no{font-family:var(--mono);font-size:.875rem;color:var(--muted)}
.said{margin:2px 0 0;font-family:var(--display);font-weight:500;font-size:1.0625rem;line-height:1.3}
.rule{margin:4px 0 0;font-size:.9375rem;font-weight:600}
.stamp{position:absolute;right:10px;top:6px;color:var(--ok);transform:rotate(4deg)}
.sheet{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:30px;background:var(--card);font-size:.9375rem}
.sheet th,.sheet td{border:1px solid var(--rule-strong);padding:6px;text-align:left;vertical-align:middle;height:44px}
.sheet thead th{font-family:var(--display);font-weight:600;background:var(--chip)}
.sheet tbody th{font-weight:600;width:22%}
.slip{display:block;border:1px solid var(--fg);background:var(--bg);padding:1px 6px;font-size:.875rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.slip i{font-style:normal;font-family:var(--mono);font-weight:400;color:var(--muted);margin-left:4px}
@keyframes bub{0%{opacity:0;transform:translateY(8px)}18%{opacity:1;transform:none}78%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-6px)}}
@keyframes drop{from{opacity:0;transform:translateY(14px)}}
@keyframes press{from{opacity:0;transform:rotate(4deg) scale(1.4)}}
@keyframes fill{from{opacity:0;transform:translateY(-6px)}}
@keyframes print{from{clip-path:inset(0 0 100% 0)}to{clip-path:inset(0 0 -12px 0)}}
.bub{animation:bub 2s var(--ease) both}
.cell:nth-child(2) .bub{animation-delay:.2s}.cell:nth-child(3) .bub{animation-delay:.4s}
.cell .ticket{animation:drop .35s var(--ease) 1.6s backwards}
.cell:nth-child(2) .ticket{animation-delay:1.8s}.cell:nth-child(3) .ticket{animation-delay:2s}
.stamp{animation:press .2s var(--ease) 2.5s backwards}
.sheet .slip{animation:fill .25s var(--ease) backwards;animation-delay:calc(2.75s + var(--n)*.17s)}
/* problem */
.moments{display:grid;gap:22px;list-style:none;margin:0;padding:12px 0 0}
.moments .ticket{padding-top:20px}
.moments p{margin:6px 0 0;color:var(--muted)}
/* how */
.steps{list-style:none;margin:0;padding:0;display:grid;gap:20px}
.steps li{display:grid;grid-template-columns:64px 1fr;gap:4px 16px;align-items:start}
.steps svg{grid-row:1/span 2;width:64px;height:64px;color:var(--fg)}
.steps .n{font-family:var(--mono);font-size:.875rem;color:var(--muted)}
.steps p{margin:2px 0 0;color:var(--muted)}
/* example */
.ex{border:1px solid var(--rule-strong);background:var(--card);padding:16px}
.ex-head{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:12px}
.ex-head p{margin:0;color:var(--muted);font-size:.9375rem}
.ex-grid{display:grid;gap:20px}
#xt{width:100%;border-collapse:collapse;table-layout:fixed;font-size:.9375rem}
#xt th,#xt td{border:1px solid var(--rule-strong);padding:4px;vertical-align:top;height:52px}
#xt thead th{background:var(--chip);font-family:var(--display);text-align:left;padding:6px}
#xt tbody th{text-align:left;font-weight:600;width:20%;padding:6px}
.xs{display:block;width:100%;margin:2px 0;padding:3px 5px;border:1px solid var(--rule-strong);border-left:4px solid var(--fg);background:var(--bg);color:var(--fg);font:inherit;font-weight:600;font-size:.875rem;text-align:left;cursor:pointer;white-space:nowrap;min-height:30px}
.xs.d{background:color-mix(in srgb,var(--fg) 10%,var(--bg))}
.xs[aria-pressed="true"]{outline:2px solid var(--ring);outline-offset:1px}
.xs.ch{background:var(--yellow);color:#1F2A2B;border-color:#1F2A2B}
.xs.gone{animation:fill .35s var(--ease)}
.rc{position:relative;background:var(--bg);border:1px solid var(--rule-strong);border-bottom:0;padding:14px 14px 20px;min-height:160px;animation:print .5s var(--ease)}
.rc .kick{font-family:var(--mono);font-size:.8125rem;color:var(--muted);margin:0}
.rc h3{margin:4px 0 8px}
.rc ul{margin:0;padding-left:1.1rem}
.rc li{margin:3px 0}
.rc .none{color:var(--muted)}
.cover{margin-top:14px;border-top:1px dashed var(--rule-strong);padding-top:12px}
.cover ol{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:8px}
.cover li{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;justify-content:space-between;border:1px solid var(--rule-strong);background:var(--card);padding:8px 10px}
.cover .x{text-decoration:line-through}
.sick{margin-top:14px;display:flex;flex-wrap:wrap;gap:10px;align-items:center}
/* trust */
.trust{list-style:none;margin:0;padding:0;display:grid;gap:18px}
.trust li{border-left:4px solid var(--fg);padding-left:14px}
.trust p{margin:4px 0 0;color:var(--muted)}
.cta-grid{display:grid;gap:24px;align-items:start}
@media (max-width:520px){.xs{white-space:normal;font-size:.75rem;padding:2px 3px;border-left-width:3px}#xt th,#xt td{padding:2px}#xt tbody th{width:19%}.slip i{display:none}.sheet th,.sheet td{padding:4px}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.bub,.cell .ticket,.stamp,.sheet .slip,.rc,.xs.gone{animation:none!important}.bub{opacity:1}}
@media (min-width:900px){
.hero{grid-template-columns:minmax(0,5fr) minmax(0,6fr);column-gap:64px;align-items:center;padding-top:40px}
.moments{grid-template-columns:repeat(3,1fr);gap:28px}
.steps{grid-template-columns:repeat(4,1fr);gap:28px}
.steps li{grid-template-columns:1fr}
.steps svg{grid-row:auto;margin-bottom:6px}
.ex-grid{grid-template-columns:minmax(0,6fr) minmax(0,5fr);column-gap:32px}
.trust{grid-template-columns:repeat(3,1fr);gap:28px}
.cta-grid{grid-template-columns:minmax(0,5fr) minmax(0,5fr);column-gap:56px}
}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs><pattern id="z" width="12" height="10" patternUnits="userSpaceOnUse"><polyline points="0,-2 6,9 12,-2" fill="var(--card)" stroke="var(--rs,var(--rule-strong))" stroke-width="1.2"/></pattern></defs></svg>
<div class="wrap">
<header class="top"><span class="brand"><svg width="22" height="26" viewBox="0 0 24 28" aria-hidden="true" fill="currentColor"><path d="M4 5h16v19l-2.67-2.5L14.67 24 12 21.5 9.33 24 6.67 21.5 4 24z" opacity=".2"/><path d="M4 5h16v19l-2.67-2.5L14.67 24 12 21.5 9.33 24 6.67 21.5 4 24z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 11.5h7M8.5 15.5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M7 1.5h10v6.5a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z"/><rect x="10.4" y="3.6" width="3.2" height="3" rx=".6" fill="var(--card)"/></svg>ShiftAssist</span><a class="quiet" href="#start" id="hdr-in">Sign in</a></header>

<main>
<section class="hero" aria-labelledby="h1">
<div>
<h1 id="h1">Your staff's texts in. A fair week out.</h1>
<p class="lead">For the manager of a small restaurant. Paste the messages your team sends you, and ShiftAssist builds the week around them and tells you why each shift went to each person.</p>
<p class="lead">It also works for any small team that works shifts, such as cafés, clinics and shops.</p>
<div class="ctas"><a class="btn main" href="#start" id="cta">Get started</a><a class="btn ghost" href="#how">See how it works</a></div>
</div>
<figure class="scene" aria-label="Example: three staff messages become tickets on a rail, one is stamped, then shifts fill a small sheet">
<figcaption><span class="tag">Example</span></figcaption>
<div class="rail" aria-hidden="true"></div>
<ul class="tk">
<li class="cell"><div class="bub"><b>Maya</b>Can't do Fridays, school pickup.</div><div class="ticket">${CLIP}<span class="no">No. 01</span><p class="said">"Can't do Fridays, school pickup."</p><p class="rule">Not available on Fridays</p><svg class="stamp" width="140" height="40" viewBox="0 0 140 40" role="img" aria-label="Confirmed"><rect x="2" y="2" width="136" height="36" rx="3" fill="var(--card)" fill-opacity=".92" stroke="currentColor" stroke-width="2.5"/><rect x="6" y="6" width="128" height="28" rx="1.5" fill="none" stroke="currentColor" stroke-width="1"/><text x="70" y="26" text-anchor="middle" fill="currentColor" style="font-family:var(--display);font-weight:600;font-size:18px;letter-spacing:.16em">CONFIRMED</text></svg>${ZIG}</div></li>
<li class="cell"><div class="bub"><b>Sam</b>Please no more than 4 shifts this week.</div><div class="ticket">${CLIP}<span class="no">No. 02</span><p class="said">"Please no more than 4 shifts this week."</p><p class="rule">At most 4 shifts a week</p>${ZIG}</div></li>
<li class="cell"><div class="bub"><b>Priya</b>Could I skip the Sunday close?</div><div class="ticket">${CLIP}<span class="no">No. 03</span><p class="said">"Could I skip the Sunday close?"</p><p class="rule">Prefers no Sunday close</p>${ZIG}</div></li>
</ul>
<table class="sheet">
<thead><tr><th></th><th>Thu</th><th>Fri</th><th>Sat</th></tr></thead>
<tbody>
<tr><th>Lunch</th><td><span class="slip" style="--n:0">Sam<i>11-4</i></span></td><td><span class="slip" style="--n:1">Priya<i>11-4</i></span></td><td><span class="slip" style="--n:2">Sam<i>11-4</i></span></td></tr>
<tr><th>Dinner</th><td><span class="slip" style="--n:3">Priya<i>5-11</i></span></td><td><span class="slip" style="--n:4">Sam<i>5-11</i></span></td><td><span class="slip" style="--n:5">Maya<i>5-11</i></span></td></tr>
</tbody>
</table>
<p class="note">Made-up names and shifts, to show the idea. Not a result.</p>
</figure>
</section>

<section class="sec" aria-labelledby="h-problem">
<h2 id="h-problem">You know this week already.</h2>
<p class="sub">Making the rota is not hard because of the shifts. It is hard because of everything people tell you around them.</p>
<ul class="moments">
<li class="ticket">${CLIP}<h3>Requests buried in the group chat</h3><p>Someone asked for Saturday off days ago. It is somewhere up the chat, under everything else.</p>${ZIG}</li>
<li class="ticket">${CLIP}<h3>"Why do I always get the late shift?"</h3><p>You try to keep it fair in your head, and you are never sure you got it right.</p>${ZIG}</li>
<li class="ticket">${CLIP}<h3>The 6am sick text</h3><p>Lunch starts soon and your cook is out. Now you are scrolling to work out who could cover.</p>${ZIG}</li>
</ul>
</section>

<section class="sec" id="how" aria-labelledby="h-how">
<h2 id="h-how">How it works</h2>
<p class="sub">Four steps. You stay in charge of every one.</p>
<ol class="steps">
<li><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="20" cy="22" r="7"/><circle cx="44" cy="22" r="7"/><path d="M8 52c0-9 5-14 12-14s12 5 12 14M32 52c0-9 5-14 12-14s12 5 12 14"/></svg><div><span class="n">Step 1</span><h3>Tell us your team</h3></div><p>Who works here, and which shifts you need in a normal week.</p></li>
<li><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 12h40a2 2 0 0 1 2 2v22a2 2 0 0 1-2 2H26l-10 9v-9H8a2 2 0 0 1-2-2V14a2 2 0 0 1 2-2z"/><path d="M14 21h28M14 29h18"/></svg><div><span class="n">Step 2</span><h3>Paste your staff's messages</h3></div><p>Each message becomes a rule. You read every one and confirm it.</p></li>
<li><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="12" width="48" height="40" rx="2"/><path d="M8 24h48M8 36h48M24 12v40M40 12v40"/><rect x="26" y="26" width="12" height="8" fill="currentColor" stroke="none"/><rect x="10" y="38" width="12" height="8" fill="currentColor" stroke="none"/></svg><div><span class="n">Step 3</span><h3>Get a week that keeps every rule</h3></div><p>Everyone is placed. Click any shift to see why that person has it.</p></li>
<li><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="18" y="6" width="28" height="52" rx="4"/><path d="M28 50h8M25 22l5 5 9-10"/></svg><div><span class="n">Step 4</span><h3>Share it, and handle sick days</h3></div><p>Send staff a link to their week. When someone cannot make it, see who can cover.</p></li>
</ol>
</section>

<section class="sec" id="try" aria-labelledby="h-try">
<h2 id="h-try">Try it right here. No account.</h2>
<p class="sub">Click any shift to see why that person has it. Then press the sick button to see how cover works.</p>
<div class="ex">
<div class="ex-head"><span class="tag">Example</span><p>Made-up people and shifts. Nothing here is saved or sent.</p></div>
<noscript><p class="hint">The example needs JavaScript. It is a small made-up week where you can click a shift and see why.</p></noscript>
<div class="ex-grid">
<div>
<table id="xt" aria-label="Example week"><thead><tr><th><span class="sr">Person</span></th><th>Thu</th><th>Fri</th><th>Sat</th></tr></thead><tbody id="xb"></tbody></table>
<div class="sick"><button type="button" class="btn ghost small" id="sick">Sam called in sick</button><span class="hint" id="sickhint">Sam is on Friday dinner.</span></div>
<div class="cover" id="cover" hidden></div>
</div>
<div class="rc" id="rc" aria-live="polite"><p class="none">Click a shift in the week and its receipt prints here.</p>${ZIG}</div>
</div>
</div>
</section>

<section class="sec" aria-labelledby="h-trust">
<h2 id="h-trust">Why you can trust it</h2>
<p class="sub">Three things that are true, and that you can check in the app.</p>
<ul class="trust">
<li><h3>You confirm every rule</h3><p>The assistant reads the messages. Nothing is used until you press Confirm on it.</p></li>
<li><h3>Rules cannot be broken</h3><p>The week is built by code that cannot place anyone against a rule you confirmed.</p></li>
<li><h3>You have the final say</h3><p>Move, lock or swap any shift yourself. We stop anything that breaks a rule.</p></li>
</ul>
</section>

<section class="sec" id="start" aria-labelledby="h-start">
<div class="cta-grid">
<div>
<h2 id="h-start">Build your first week.</h2>
<p class="sub">Make an account, then try the sample restaurant in about a minute, or set up your own. ShiftAssist never sends messages for you. When someone needs to be told something, it writes the message and you copy it.</p>
</div>
<div class="panel">
<div class="tabs" role="tablist" aria-label="Account">
<button type="button" role="tab" id="tab-up" aria-selected="true" aria-controls="form">Create account</button>
<button type="button" role="tab" id="tab-in" aria-selected="false" aria-controls="form">Sign in</button>
</div>
<form id="form" novalidate>
<label for="email">Email</label>
<input id="email" name="email" type="email" autocomplete="email" required>
<label for="password">Password</label>
<input id="password" name="password" type="password" autocomplete="new-password" required>
<p class="hint" id="pw-hint">At least ${PASSWORD_MIN} characters.</p>
<button class="go" id="go" type="submit">Create account</button>
<p class="msg" id="msg" role="alert" aria-live="polite"></p>
${forgot ? '<button class="link" id="forgot" type="button" hidden>Forgot your password?</button>' : ""}
</form>
</div>
</div>
</section>
</main>
</div>
<style>.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}</style>
<script>
(function(){
  var MIN=${PASSWORD_MIN}, FORGOT=${forgot ? "true" : "false"};
  var mode="up";
  var $=function(id){return document.getElementById(id)};
  var form=$("form"),email=$("email"),pw=$("password"),go=$("go"),msg=$("msg"),hint=$("pw-hint"),fg=$("forgot");
  function say(t,kind){msg.textContent=t||"";msg.className="msg"+(kind?" "+kind:"")}
  function setMode(m){
    mode=m;say("");
    $("tab-up").setAttribute("aria-selected",m==="up");
    $("tab-in").setAttribute("aria-selected",m==="in");
    go.textContent=m==="up"?"Create account":"Sign in";
    pw.setAttribute("autocomplete",m==="up"?"new-password":"current-password");
    hint.hidden=m!=="up";
    if(fg)fg.hidden=m!=="in";
  }
  $("tab-up").onclick=function(){setMode("up")};
  $("tab-in").onclick=function(){setMode("in")};
  function toForm(m){
    setMode(m);
    var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    $("start").scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"});
    window.setTimeout(function(){email.focus({preventScroll:true})},reduce?0:450);
  }
  $("cta").addEventListener("click",function(ev){ev.preventDefault();toForm("up")});
  $("hdr-in").addEventListener("click",function(ev){ev.preventDefault();toForm("in")});
  function post(path,body){
    return fetch(path,{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
      .then(function(r){return r.json().catch(function(){return {}}).then(function(d){return {ok:r.ok,status:r.status,data:d||{}}})});
  }
  function errOf(res,fallback){
    var d=res.data,m=typeof d.error==="string"&&d.error.trim()?d.error.trim():(typeof d.message==="string"&&d.message.trim()?d.message.trim():"");
    return m||fallback;
  }
  function login(e,p){
    return post("/_agent-native/auth/login",{email:e,password:p}).then(function(res){
      if(res.ok&&!res.data.error){window.location.assign("/home");return}
      say(errOf(res,"We couldn't sign you in. Check your email and password."),"err");
      go.disabled=false;
    });
  }
  form.addEventListener("submit",function(ev){
    ev.preventDefault();
    var e=email.value.trim(),p=pw.value;
    if(!e||e.indexOf("@")<1){say("Enter a valid email address.","err");return}
    if(!p){say("Enter your password.","err");return}
    if(mode==="up"&&p.length<MIN){say("Your password needs at least "+MIN+" characters. It has "+p.length+".","err");return}
    go.disabled=true;say(mode==="up"?"Creating your account...":"Signing in...");
    if(mode==="in"){login(e,p).catch(function(){say("Couldn't reach the server. Check your connection and try again.","err");go.disabled=false});return}
    post("/_agent-native/auth/register",{email:e,password:p}).then(function(res){
      if(!res.ok||res.data.error){
        say(errOf(res,"We couldn't create the account. Please try again."),"err");go.disabled=false;return;
      }
      return login(e,p);
    }).catch(function(){say("Couldn't reach the server. Check your connection and try again.","err");go.disabled=false});
  });
  if(fg){
    fg.onclick=function(){
      var e=email.value.trim();
      if(!e||e.indexOf("@")<1){say("Type your email above first, then press Forgot your password.","err");return}
      fg.disabled=true;say("Sending...");
      post("/_agent-native/auth/ba/request-password-reset",{email:e}).then(function(res){
        fg.disabled=false;
        if(res.ok&&!res.data.error){say("If an account exists for that email, a reset link is on its way.","ok")}
        else say(errOf(res,"We couldn't send a reset email. Please try again."),"err");
      }).catch(function(){fg.disabled=false;say("Couldn't reach the server. Check your connection and try again.","err")});
    };
  }
  setMode("up");
})();

/* The Example: static, made-up data. Nothing here touches the network. */
(function(){
  var P={sam:"Sam",priya:"Priya",maya:"Maya",tom:"Tom"};
  var ORDER=["sam","priya","maya","tom"];
  var DAYS=["Thu","Fri","Sat"];
  var FULL=["Thursday","Friday","Saturday"];
  var start=function(){return [
    {id:"a",d:0,b:"Lunch",t:"11-4",who:"sam",ch:false},
    {id:"b",d:0,b:"Dinner",t:"5-11",who:"priya",ch:false},
    {id:"c",d:1,b:"Lunch",t:"11-4",who:"priya",ch:false},
    {id:"d",d:1,b:"Dinner",t:"5-11",who:"sam",ch:false},
    {id:"e",d:2,b:"Lunch",t:"11-4",who:"tom",ch:false},
    {id:"f",d:2,b:"Dinner",t:"5-11",who:"maya",ch:false}
  ]};
  var WHY={
    a:["Sam is free on Thursday.","Sam has 2 shifts this week, under the limit of 4 Sam asked for.","Lunch needs a server and Sam is one."],
    b:["Priya is free on Thursday.","This is Priya's first closing shift, so closing shifts stay even.","Priya asked to skip Sunday closes. This is a Thursday."],
    c:["Priya is free on Friday.","Maya can't work Fridays (school pickup), so Maya was not an option.","Priya has 2 shifts, under her limit."],
    d:["Sam is free on Friday.","Sam has 2 shifts, under the limit of 4.","Maya can't work Fridays, and Priya is already on Friday lunch."],
    e:["Tom is free on Saturday.","Tom has only 1 shift this week, so Tom gets this one to even things out."],
    f:["Maya is free on Saturday.","Maya has 1 shift this week, the fewest of anyone.","Maya's only rule is no Fridays, and this is a Saturday."]
  };
  var slots=start(),sel=null,sick=false,note="";
  var body=document.getElementById("xb"),rc=document.getElementById("rc"),cv=document.getElementById("cover"),sk=document.getElementById("sick"),skh=document.getElementById("sickhint");
  var zig=${JSON.stringify(ZIG)};
  function el(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e}
  function byId(id){for(var i=0;i<slots.length;i++)if(slots[i].id===id)return slots[i]}
  function draw(){
    body.textContent="";
    ORDER.forEach(function(pid){
      var tr=el("tr"),th=el("th",null,P[pid]);th.setAttribute("scope","row");tr.appendChild(th);
      for(var d=0;d<3;d++){
        var td=el("td");
        slots.filter(function(s){return s.who===pid&&s.d===d}).forEach(function(s){
          var b=el("button","xs"+(s.b==="Dinner"?" d":"")+(s.ch?" ch":""),s.b+" "+s.t);
          b.type="button";b.setAttribute("aria-pressed",String(sel===s.id));
          b.setAttribute("aria-label",P[pid]+", "+FULL[d]+" "+s.b.toLowerCase()+", "+s.t+(s.ch?", changed":""));
          b.onclick=function(){sel=s.id;draw();receipt()};
          td.appendChild(b);
        });
        tr.appendChild(td);
      }
      body.appendChild(tr);
    });
  }
  function receipt(){
    rc.textContent="";
    var s=sel&&byId(sel);
    if(!s){rc.appendChild(el("p","none","Click a shift in the week and its receipt prints here."));rc.insertAdjacentHTML("beforeend",zig);return}
    rc.appendChild(el("p","kick",s.b+", "+FULL[s.d]+", "+s.t+" (Example)"));
    rc.appendChild(el("h3",null,P[s.who]+" has this shift because..."));
    var ul=el("ul"),why=s.ch?["You moved it here after Sam called in sick.","Sam is marked off that day.","Nothing is sent. In the real app you get a message to copy."]:WHY[s.id];
    why.forEach(function(w){ul.appendChild(el("li",null,w))});
    rc.appendChild(ul);
    rc.insertAdjacentHTML("beforeend",zig);
  }
  function cover(){
    cv.textContent="";
    if(!sick){cv.hidden=true;return}
    cv.hidden=false;
    cv.appendChild(el("h3",null,"Sam can't make Friday dinner. Who can cover?"));
    var ol=el("ol");
    [["tom","Tom is free on Friday and has the fewest shifts (1)."],["priya","Priya is free for dinner, but already works Friday lunch, so it would be a double."]].forEach(function(o){
      var li=el("li"),sp=el("span",null,o[1]),b=el("button","btn main small","Choose "+P[o[0]]);b.type="button";
      b.onclick=function(){var s=byId("d");s.who=o[0];s.ch=true;sick=false;sel="d";note="Moved. In the real app, we also write a message to your cover for you to copy.";draw();receipt();cover();sync();var m=document.querySelector(".xs.ch");if(m){m.classList.add("gone");m.focus()}};
      li.appendChild(sp);li.appendChild(b);ol.appendChild(li);
    });
    var bl=el("li"),bs=el("span","x","Maya");bl.appendChild(bs);bl.appendChild(el("span",null,"Can't work Fridays (school pickup)."));ol.appendChild(bl);
    cv.appendChild(ol);
  }
  function sync(){
    var moved=byId("d").ch;
    sk.textContent=moved?"Start the example again":"Sam called in sick";
    skh.textContent=moved?note:"Sam is on Friday dinner.";
  }
  sk.onclick=function(){
    if(byId("d").ch){slots=start();sel=null;sick=false;note="";draw();receipt();cover();sync();return}
    sick=!sick;sel="d";draw();receipt();cover();
    if(sick)cv.scrollIntoView({block:"nearest"});
  };
  draw();receipt();cover();sync();
})();
</script>
</body>
</html>`;
}
