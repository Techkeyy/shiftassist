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
:root{color-scheme:light dark;--bg:#faf8f4;--fg:#1d1b18;--muted:#5f5a52;--card:#fff;--line:#d9d3c8;--accent:#1f5f4a;--accent-fg:#fff;--err:#9b1c1c;--ok:#1f5f4a;--chip:#e6efe9}
@media (prefers-color-scheme:dark){:root{--bg:#161512;--fg:#f1eee8;--muted:#b3ada1;--card:#1f1d19;--line:#3a362f;--accent:#7cc6a6;--accent-fg:#10201a;--err:#ff9b9b;--ok:#7cc6a6;--chip:#25322c}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:1040px;margin:0 auto;padding:32px 16px 48px;display:grid;gap:32px}
@media (min-width:860px){main{grid-template-columns:1fr 1fr;align-items:start;padding-top:64px}}
h1{margin:0 0 8px;font-size:28px;line-height:1.2}
.lead{margin:0 0 24px;color:var(--muted);max-width:34em}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px}
.tabs{display:flex;gap:8px;margin-bottom:12px}
.tabs button{flex:1;min-height:44px;border:1px solid var(--line);background:transparent;color:var(--fg);border-radius:6px;font:inherit;font-weight:600;cursor:pointer}
.tabs button[aria-selected="true"]{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)}
label{display:block;font-size:14px;font-weight:600;margin:12px 0 4px}
input{width:100%;min-height:44px;padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--bg);color:var(--fg);font:inherit}
.hint{font-size:13px;color:var(--muted);margin:4px 0 0}
.go{margin-top:16px;width:100%;min-height:44px;border:0;border-radius:6px;background:var(--accent);color:var(--accent-fg);font:inherit;font-weight:700;cursor:pointer}
.go:disabled{opacity:.6;cursor:wait}
.link{background:none;border:0;padding:8px 0;color:var(--fg);text-decoration:underline;font:inherit;cursor:pointer;min-height:44px}
.msg{margin:12px 0 0;font-size:14px;min-height:1.4em}
.msg.err{color:var(--err)}.msg.ok{color:var(--ok)}
[hidden]{display:none!important}
.example{margin-top:0}
.example h2{margin:0 0 8px;font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.tag{display:inline-block;border:1px solid var(--line);border-radius:4px;padding:0 6px;font-size:12px;font-weight:700;color:var(--muted);margin-left:6px;vertical-align:middle}
.grid{width:100%;border-collapse:collapse;font-size:13px;table-layout:fixed}
.grid th,.grid td{border:1px solid var(--line);padding:6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
.grid th{font-weight:600;background:var(--chip)}
.chip{display:block;background:var(--chip);border-radius:4px;padding:2px 6px;margin:2px 0}
.note{font-size:13px;color:var(--muted);margin:8px 0 0}
</style>
</head>
<body>
<main>
<section>
<h1>ShiftAssist</h1>
<p class="lead">Paste your staff's messages. ShiftAssist builds a week that keeps their rules, and can explain every shift.</p>
<div class="card">
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
</section>
<aside class="card example" aria-label="Example board">
<h2>Example<span class="tag">Not real data</span></h2>
<table class="grid">
<thead><tr><th></th><th>Thu</th><th>Fri</th><th>Sat</th></tr></thead>
<tbody>
<tr><th>Lunch</th><td><span class="chip">Sam, server</span></td><td><span class="chip">Priya, server</span></td><td><span class="chip">Sam, server</span></td></tr>
<tr><th>Dinner</th><td><span class="chip">Luis, cook</span></td><td><span class="chip">Luis, cook</span></td><td><span class="chip">Maya, cook</span></td></tr>
</tbody>
</table>
<p class="note">Example rule it kept: "Maya can't work Fridays." Click any shift to see why that person has it.</p>
</aside>
</main>
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
