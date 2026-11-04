/**
 * The signed-out page. The toolkit's auth page cannot be restyled, so this is a small
 * self-contained document passed to createToolkitAuthPlugin({ loginHtml }).
 *
 * Endpoints (checked against @agent-native/core/server/auth.js):
 *   POST /_agent-native/auth/register  { email, password }   -> { ok: true } | { error }
 *   POST /_agent-native/auth/login     { email, password }   -> session cookie | { error }
 *   POST /_agent-native/auth/ba/request-password-reset { email }
 * Register does not sign in, so the page logs in right after, as the toolkit page does.
 * The password minimum is 12 characters. No metrics, quotes or customers appear here.
 */
export const PASSWORD_MIN = 12;

export function buildLandingHtml(opts: { forgotPassword: boolean }): string {
  const forgot = opts.forgotPassword;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ShiftAssist</title>
<meta name="description" content="Paste your staff's messages. ShiftAssist builds a week that keeps their rules, and can explain every shift.">
<style>
@font-face{font-family:"Zilla Slab";font-weight:600;font-style:normal;font-display:swap;src:url(/fonts/zilla-slab-latin-600-normal.woff2) format("woff2")}
@font-face{font-family:"Zilla Slab";font-weight:500;font-style:normal;font-display:swap;src:url(/fonts/zilla-slab-latin-500-normal.woff2) format("woff2")}
@font-face{font-family:"Familjen Grotesk";font-weight:400 700;font-style:normal;font-display:swap;src:url(/fonts/familjen-grotesk-latin-wght-normal.woff2) format("woff2")}
@font-face{font-family:"IBM Plex Mono";font-weight:400;font-style:normal;font-display:swap;src:url(/fonts/ibm-plex-mono-latin-400-normal.woff2) format("woff2")}
:root{color-scheme:light dark;--bg:#F7F2E8;--card:#FFFDF7;--fg:#1F2A2B;--muted:#55605F;--rule-strong:#7D827E;--primary:#1F2A2B;--primary-fg:#F7F2E8;--ring:#28598A;--problem:#B93A26;--ok:#2B6B49;--chip:#EFE8D8;--ease:cubic-bezier(.22,.61,.36,1);
--display:"Zilla Slab",Georgia,serif;--ui:"Familjen Grotesk","Segoe UI",system-ui,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Menlo,monospace}
@media (prefers-color-scheme:dark){:root{--bg:#14191B;--card:#1C2326;--fg:#F2EDE0;--muted:#AAB5B0;--rule-strong:#6F7C7E;--primary:#F2EDE0;--primary-fg:#14191B;--ring:#8DB7E6;--problem:#F08A78;--ok:#7DC59C;--chip:#232C2F}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--fg);font:1rem/1.5 var(--ui)}
.page{max-width:1160px;margin:0 auto;padding:20px 16px 48px;display:grid;gap:32px}
.brand{display:flex;align-items:center;gap:8px;font-family:var(--display);font-weight:600;font-size:1.25rem;color:var(--fg)}
.brand svg{display:block}
h1{margin:0 0 12px;font-family:var(--display);font-weight:600;font-size:clamp(2rem,6.4vw,3.25rem);line-height:1.1;letter-spacing:0}
.lead{margin:0 0 20px;color:var(--muted);max-width:30em;font-size:1.0625rem}
.panel{background:var(--card);border:1px solid var(--rule-strong);padding:16px;max-width:30rem}
.tabs{display:flex;gap:8px;margin-bottom:8px}
.tabs button{flex:1;min-height:44px;border:1px solid var(--rule-strong);background:transparent;color:var(--fg);border-radius:6px;font:inherit;font-weight:600;cursor:pointer}
.tabs button[aria-selected="true"]{background:var(--primary);color:var(--primary-fg);border-color:var(--primary)}
label{display:block;font-size:.9375rem;font-weight:600;margin:12px 0 4px}
input{width:100%;min-height:44px;padding:8px 10px;border:1px solid var(--rule-strong);border-radius:6px;background:var(--bg);color:var(--fg);font:inherit}
:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
.hint{font-size:.9375rem;color:var(--muted);margin:4px 0 0}
.go{margin-top:16px;width:100%;min-height:44px;border:1px solid var(--primary);border-radius:6px;background:var(--primary);color:var(--primary-fg);font:inherit;font-weight:700;cursor:pointer}
.go:disabled{opacity:.6;cursor:wait}
.link{background:none;border:0;padding:8px 0;color:var(--fg);text-decoration:underline;text-underline-offset:3px;font:inherit;cursor:pointer;min-height:44px}
.msg{margin:12px 0 0;font-size:.9375rem;min-height:1.4em}
.msg.err{color:var(--problem)}.msg.ok{color:var(--ok)}
[hidden]{display:none!important}
.tag{display:inline-block;border:1px solid var(--rule-strong);padding:0 .5rem;font-size:.875rem;font-weight:600;background:var(--card)}
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
.ticket .zig{position:absolute;left:-1px;bottom:-9px;width:calc(100% + 2px);height:10px;color:var(--rule-strong)}
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
.bub{animation:bub 2s var(--ease) both}
.cell:nth-child(2) .bub{animation-delay:.2s}.cell:nth-child(3) .bub{animation-delay:.4s}
.cell .ticket{animation:drop .35s var(--ease) 1.6s backwards}
.cell:nth-child(2) .ticket{animation-delay:1.8s}.cell:nth-child(3) .ticket{animation-delay:2s}
.stamp{animation:press .2s var(--ease) 2.5s backwards}
.slip{animation:fill .25s var(--ease) backwards;animation-delay:calc(2.75s + var(--n)*.17s)}
@media (max-width:520px){.slip i{display:none}.sheet th,.sheet td{padding:4px}}
@media (prefers-reduced-motion:reduce){.bub,.cell .ticket,.stamp,.slip{animation:none!important}}
@media (min-width:900px){.page{grid-template-columns:minmax(0,5fr) minmax(0,6fr);column-gap:64px;align-items:start;padding-top:28px}.intro{grid-column:1}.scene{grid-column:2;grid-row:1/span 2;padding-top:36px}.hero{padding-top:56px}}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs><pattern id="z" width="12" height="10" patternUnits="userSpaceOnUse"><polyline points="0,-2 6,9 12,-2" fill="var(--card)" stroke="var(--rs,var(--rule-strong))" stroke-width="1.2"/></pattern></defs></svg>
<div class="page">
<header class="intro"><span class="brand"><svg width="22" height="26" viewBox="0 0 24 28" aria-hidden="true" fill="currentColor"><path d="M4 5h16v19l-2.67-2.5L14.67 24 12 21.5 9.33 24 6.67 21.5 4 24z" opacity=".2"/><path d="M4 5h16v19l-2.67-2.5L14.67 24 12 21.5 9.33 24 6.67 21.5 4 24z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 11.5h7M8.5 15.5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/><path d="M7 1.5h10v6.5a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z"/><rect x="10.4" y="3.6" width="3.2" height="3" rx=".6" fill="var(--card)"/></svg>ShiftAssist</span></header>
<main class="hero intro">
<h1>Your staff's texts in. A fair week out.</h1>
<p class="lead">Paste the messages your team sends you. ShiftAssist turns each one into a rule you confirm, builds the week around them, and can tell you why any shift went to the person it did.</p>
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
</main>
<figure class="scene" aria-label="Example: three staff messages become tickets on a rail, one is stamped, then shifts fill a small sheet">
<figcaption><span class="tag">Example</span></figcaption>
<div class="rail" aria-hidden="true"></div>
<ul class="tk">
<li class="cell"><div class="bub"><b>Maya</b>Can't do Fridays, school pickup.</div><div class="ticket"><svg class="clip" width="16" height="22" viewBox="0 0 16 22" aria-hidden="true"><path d="M2 1.5h12v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 9.5z" fill="currentColor"/><rect x="6.2" y="3.8" width="3.6" height="3.4" rx=".7" fill="var(--card)"/><path d="M8 11v9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span class="no">No. 01</span><p class="said">"Can't do Fridays, school pickup."</p><p class="rule">Not available on Fridays</p><svg class="stamp" width="140" height="40" viewBox="0 0 140 40" role="img" aria-label="Confirmed"><rect x="2" y="2" width="136" height="36" rx="3" fill="var(--card)" fill-opacity=".92" stroke="currentColor" stroke-width="2.5"/><rect x="6" y="6" width="128" height="28" rx="1.5" fill="none" stroke="currentColor" stroke-width="1"/><text x="70" y="26" text-anchor="middle" fill="currentColor" style="font-family:var(--display);font-weight:600;font-size:18px;letter-spacing:.16em">CONFIRMED</text></svg><svg class="zig" viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden="true"><rect width="100%" height="10" fill="url(#z)"/></svg></div></li>
<li class="cell"><div class="bub"><b>Sam</b>Please no more than 4 shifts this week.</div><div class="ticket"><svg class="clip" width="16" height="22" viewBox="0 0 16 22" aria-hidden="true"><path d="M2 1.5h12v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 9.5z" fill="currentColor"/><rect x="6.2" y="3.8" width="3.6" height="3.4" rx=".7" fill="var(--card)"/><path d="M8 11v9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span class="no">No. 02</span><p class="said">"Please no more than 4 shifts this week."</p><p class="rule">At most 4 shifts a week</p><svg class="zig" viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden="true"><rect width="100%" height="10" fill="url(#z)"/></svg></div></li>
<li class="cell"><div class="bub"><b>Priya</b>Could I skip the Sunday close?</div><div class="ticket"><svg class="clip" width="16" height="22" viewBox="0 0 16 22" aria-hidden="true"><path d="M2 1.5h12v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 9.5z" fill="currentColor"/><rect x="6.2" y="3.8" width="3.6" height="3.4" rx=".7" fill="var(--card)"/><path d="M8 11v9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><span class="no">No. 03</span><p class="said">"Could I skip the Sunday close?"</p><p class="rule">Prefers no Sunday close</p><svg class="zig" viewBox="0 0 120 10" preserveAspectRatio="none" aria-hidden="true"><rect width="100%" height="10" fill="url(#z)"/></svg></div></li>
</ul>
<table class="sheet">
<thead><tr><th></th><th>Thu</th><th>Fri</th><th>Sat</th></tr></thead>
<tbody>
<tr><th>Lunch</th><td><span class="slip" style="--n:0">Sam<i>11-16</i></span></td><td><span class="slip" style="--n:1">Priya<i>11-16</i></span></td><td><span class="slip" style="--n:2">Sam<i>11-16</i></span></td></tr>
<tr><th>Dinner</th><td><span class="slip" style="--n:3">Priya<i>17-23</i></span></td><td><span class="slip" style="--n:4">Sam<i>17-23</i></span></td><td><span class="slip" style="--n:5">Maya<i>17-23</i></span></td></tr>
</tbody>
</table>
<p class="note">Made-up names and shifts, to show the idea. Not a result.</p>
</figure>
</div>
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
      if(res.ok&&!res.data.error){window.location.assign("/board");return}
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
</script>
</body>
</html>`;
}
