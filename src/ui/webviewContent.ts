import * as vscode from 'vscode';

export function getWebviewContent(_webview: vscode.Webview, _extensionUri: vscode.Uri): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
  <title>SecureScan</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:        var(--vscode-sideBar-background, #0d1117);
      --bg-card:   var(--vscode-editor-background, #161b22);
      --bg-input:  var(--vscode-input-background, #1c2128);
      --border:    var(--vscode-panel-border, #30363d);
      --text:      var(--vscode-foreground, #e6edf3);
      --muted:     var(--vscode-descriptionForeground, #7d8590);
      --accent:    var(--vscode-button-background, #238636);
      --accent-h:  var(--vscode-button-hoverBackground, #2ea043);
      --critical:  #f85149;
      --high:      #f97316;
      --medium:    #f59e0b;
      --low:       #58a6ff;
      --success:   #3fb950;
      --r:         8px;
      --rs:        5px;
    }

    html,body { background:var(--bg); color:var(--text);
      font-family:var(--vscode-font-family,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif);
      font-size:13px; line-height:1.5; height:100%; overflow-x:hidden; }

    #app { padding:12px; min-height:100vh; }

    /* ── Buttons ── */
    .btn { display:inline-flex; align-items:center; gap:7px; padding:8px 14px;
      border:none; border-radius:var(--rs); font-size:12px; font-weight:600;
      cursor:pointer; transition:all .15s; white-space:nowrap; }
    .btn-primary { background:var(--accent); color:#fff; width:100%; justify-content:center; }
    .btn-primary:hover { background:var(--accent-h); }
    .btn-secondary { background:transparent; color:var(--text); border:1px solid var(--border); width:100%; justify-content:center; }
    .btn-secondary:hover { background:rgba(255,255,255,.04); }
    .btn-ghost { background:transparent; color:var(--muted); border:none; padding:4px 8px; font-size:11px; }
    .btn-ghost:hover { color:var(--text); }
    .btn-sm { padding:4px 10px; font-size:11px; }
    .btn:disabled { opacity:.5; cursor:not-allowed; }

    /* OAuth provider buttons */
    .oauth-btn {
      display:flex; align-items:center; justify-content:center; gap:10px;
      width:100%; padding:10px 14px; border-radius:var(--rs);
      font-size:13px; font-weight:500; cursor:pointer;
      transition:all .15s; border:1px solid var(--border);
      background:var(--bg-card); color:var(--text); margin-bottom:8px;
    }
    .oauth-btn:hover { background:rgba(255,255,255,.06); border-color:rgba(255,255,255,.15); }
    .oauth-btn:active { transform:scale(.98); }
    .oauth-btn:disabled { opacity:.5; cursor:not-allowed; }
    .oauth-icon { width:18px; height:18px; flex-shrink:0; }

    /* ── Cards ── */
    .card { background:var(--bg-card); border:1px solid var(--border);
      border-radius:var(--r); padding:14px; margin-bottom:10px; }
    .card-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
    .card-title { font-size:11px; font-weight:700; text-transform:uppercase;
      letter-spacing:.06em; color:var(--muted); }

    /* ── Score Ring ── */
    .score-container { display:flex; flex-direction:column; align-items:center; padding:14px 0; }
    .score-ring { position:relative; width:100px; height:100px; }
    .score-ring svg { transform:rotate(-90deg); }
    .score-ring circle { fill:none; stroke-width:8; stroke-linecap:round; }
    .score-ring .track { stroke:var(--border); }
    .score-ring .fill { transition:stroke-dashoffset .8s ease; }
    .score-number { position:absolute; inset:0; display:flex; flex-direction:column;
      align-items:center; justify-content:center; }
    .score-value { font-size:26px; font-weight:700; line-height:1; }
    .score-sub { font-size:10px; color:var(--muted); margin-top:2px; }
    .score-grade { font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px; margin-top:8px; }

    /* ── Stats row ── */
    .stats-row { display:grid; grid-template-columns:repeat(4,1fr); gap:6px; margin-top:12px; }
    .stat { text-align:center; padding:8px 4px; border-radius:var(--rs); background:rgba(255,255,255,.03); }
    .stat-v { font-size:18px; font-weight:700; }
    .stat-k { font-size:9px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); }
    .c .stat-v { color:var(--critical); }
    .h .stat-v { color:var(--high); }
    .m .stat-v { color:var(--medium); }
    .l .stat-v { color:var(--low); }

    /* ── Badge ── */
    .badge { display:inline-flex; align-items:center; padding:2px 7px; border-radius:20px;
      font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.04em; }
    .badge-critical { background:rgba(248,81,73,.15); color:var(--critical); border:1px solid rgba(248,81,73,.3); }
    .badge-high     { background:rgba(249,115,22,.15); color:var(--high);     border:1px solid rgba(249,115,22,.3); }
    .badge-medium   { background:rgba(245,158,11,.15); color:var(--medium);   border:1px solid rgba(245,158,11,.3); }
    .badge-low      { background:rgba(88,166,255,.15); color:var(--low);      border:1px solid rgba(88,166,255,.3); }

    /* ── Issues ── */
    .issue-item { border:1px solid var(--border); border-radius:var(--rs);
      margin-bottom:6px; overflow:hidden; transition:border-color .15s; }
    .issue-item.resolved { opacity:.45; }
    .issue-item:hover { border-color:rgba(255,255,255,.15); }
    .issue-hdr { display:flex; align-items:center; gap:8px; padding:10px 12px;
      cursor:pointer; user-select:none; }
    .issue-title { flex:1; font-size:12px; font-weight:500; }
    .issue-chev { color:var(--muted); font-size:10px; transition:transform .2s; }
    .issue-item.open .issue-chev { transform:rotate(90deg); }
    .issue-body { display:none; padding:0 12px 12px; border-top:1px solid var(--border); }
    .issue-item.open .issue-body { display:block; }
    .issue-desc { color:var(--muted); font-size:12px; margin:10px 0; }
    .sec-lbl { font-size:10px; font-weight:700; text-transform:uppercase;
      letter-spacing:.05em; color:var(--muted); margin:10px 0 5px; }
    .loc { display:flex; align-items:center; gap:6px; padding:5px 8px;
      background:rgba(255,255,255,.03); border-radius:var(--rs); margin-bottom:3px;
      cursor:pointer; font-size:11px; font-family:monospace; transition:background .1s; }
    .loc:hover { background:rgba(255,255,255,.08); }
    .loc-file { color:var(--low); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .loc-line { color:var(--muted); flex-shrink:0; }
    .issue-actions { display:flex; gap:6px; margin-top:10px; flex-wrap:wrap; }
    .atk { background:rgba(248,81,73,.06); border:1px solid rgba(248,81,73,.15);
      border-radius:var(--rs); padding:8px 10px; font-size:11px; color:var(--muted); margin-top:8px; }
    .atk strong { color:var(--critical); display:block; margin-bottom:3px; }

    /* ── Modal ── */
    .modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.65);
      z-index:100; align-items:flex-start; justify-content:center; padding:20px; }
    .modal-overlay.open { display:flex; }
    .modal { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--r);
      width:100%; max-height:82vh; overflow-y:auto; }
    .modal-hdr { display:flex; align-items:center; justify-content:space-between;
      padding:14px 16px; border-bottom:1px solid var(--border); }
    .modal-title { font-size:13px; font-weight:600; }
    .modal-body { padding:14px 16px; }
    .prompt-box { background:rgba(0,0,0,.3); border:1px solid var(--border); border-radius:var(--rs);
      padding:10px; font-size:11px; font-family:monospace; white-space:pre-wrap;
      word-break:break-word; color:var(--text); max-height:280px; overflow-y:auto; margin:8px 0; }

    /* ── Progress ── */
    .progress-wrap { margin:10px 0; }
    .progress-msg { font-size:11px; color:var(--muted); margin-bottom:5px; }
    .progress-bg { height:4px; background:var(--border); border-radius:2px; overflow:hidden; }
    .progress-fill { height:100%; border-radius:2px; background:var(--accent); transition:width .3s ease; }

    /* ── Tabs ── */
    .tabs { display:flex; border-bottom:1px solid var(--border); margin-bottom:12px; }
    .tab { padding:8px 14px; font-size:12px; font-weight:500; color:var(--muted);
      cursor:pointer; border-bottom:2px solid transparent; transition:all .15s; }
    .tab.active { color:var(--text); border-bottom-color:var(--accent); }
    .tab:hover:not(.active) { color:var(--text); }

    /* ── User ── */
    .user-card { display:flex; align-items:center; gap:10px; padding:10px 12px;
      background:rgba(255,255,255,.03); border-radius:var(--rs); border:1px solid var(--border);
      margin-bottom:12px; }
    .avatar { width:32px; height:32px; border-radius:50%; background:var(--accent);
      display:flex; align-items:center; justify-content:center;
      font-weight:700; font-size:13px; flex-shrink:0; overflow:hidden; }
    .avatar img { width:100%; height:100%; object-fit:cover; }
    .u-info { flex:1; min-width:0; }
    .u-name { font-size:12px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .u-email { font-size:11px; color:var(--muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

    /* ── Section ── */
    .section-title { font-size:11px; font-weight:700; text-transform:uppercase;
      letter-spacing:.08em; color:var(--muted); margin:14px 0 8px;
      padding-bottom:5px; border-bottom:1px solid var(--border); }

    /* ── Empty ── */
    .empty { text-align:center; padding:28px 16px; color:var(--muted); }
    .empty-icon { font-size:36px; margin-bottom:10px; }
    .empty-title { font-size:13px; font-weight:600; color:var(--text); margin-bottom:5px; }

    /* ── Toast ── */
    .toast { position:fixed; bottom:16px; left:50%; transform:translateX(-50%);
      background:#1f2937; border:1px solid var(--border); padding:8px 16px;
      border-radius:var(--rs); font-size:12px; z-index:200;
      transition:opacity .3s; pointer-events:none; }

    /* ── Logo ── */
    .logo { display:flex; align-items:center; gap:8px; margin-bottom:14px;
      padding-bottom:12px; border-bottom:1px solid var(--border); }
    .logo-icon { font-size:20px; }
    .logo-text { font-size:15px; font-weight:700; letter-spacing:-.02em; }
    .logo-beta { font-size:9px; font-weight:600; padding:1px 5px; border-radius:3px;
      background:rgba(88,166,255,.15); color:var(--low); border:1px solid rgba(88,166,255,.25); }

    .fw-badge { display:inline-flex; align-items:center; gap:4px; padding:3px 8px;
      border-radius:20px; font-size:11px; background:rgba(88,166,255,.1);
      color:var(--low); border:1px solid rgba(88,166,255,.2); }

    .scan-meta { display:flex; gap:12px; font-size:11px; color:var(--muted);
      margin-top:8px; flex-wrap:wrap; }

    .check-item { display:flex; align-items:center; gap:8px; padding:6px 0; font-size:12px; }
    .check-icon { font-size:14px; flex-shrink:0; }
    .check-resolved { text-decoration:line-through; color:var(--muted); }

    @keyframes spin { to { transform:rotate(360deg); } }
    .spinner { display:inline-block; width:14px; height:14px; border:2px solid var(--border);
      border-top-color:var(--accent); border-radius:50%; animation:spin .6s linear infinite; }

    .divider { display:flex; align-items:center; gap:8px; margin:12px 0; color:var(--muted); font-size:11px; }
    .divider::before,.divider::after { content:''; flex:1; height:1px; background:var(--border); }

    .waiting-box { text-align:center; padding:20px; color:var(--muted); font-size:12px; }
    .waiting-box .spinner { width:20px; height:20px; margin:0 auto 10px; display:block; }
  </style>
</head>
<body>
<div id="app">
  <div class="logo">
    <span class="logo-icon">🛡️</span>
    <span class="logo-text">SecureScan</span>
    <span class="logo-beta">BETA</span>
  </div>
  <div id="root"></div>
</div>

<!-- Fix Modal -->
<div class="modal-overlay" id="fixModal">
  <div class="modal">
    <div class="modal-hdr">
      <span class="modal-title" id="fixModalTitle">AI Fix Prompt</span>
      <button class="btn btn-ghost" style="padding:4px 8px;" onclick="closeFixModal()">✕</button>
    </div>
    <div class="modal-body" id="fixModalBody"></div>
  </div>
</div>

<div class="toast" id="toast" style="opacity:0"></div>

<script>
const vscode = acquireVsCodeApi();

// ── State ────────────────────────────────────────────────────────────────────
let S = {
  auth: { isAuthenticated: false, user: null, sessionToken: null },
  scan: null,
  resolved: [],
  scanning: false,
  oauthWaiting: false,    // browser is open, waiting for user
  oauthProvider: null,
  progress: { message: '', percent: 0 },
  fixPrompt: null,
  tab: 'dashboard',
  error: null,
};

function set(patch) { S = { ...S, ...patch }; render(); }

// ── Messages ─────────────────────────────────────────────────────────────────
window.addEventListener('message', ev => {
  const msg = ev.data;
  switch (msg.type) {
    case 'updateState':
      set({
        ...(msg.payload.authState   !== undefined && { auth: msg.payload.authState }),
        ...(msg.payload.scanResult  !== undefined && { scan: msg.payload.scanResult }),
        ...(msg.payload.resolvedIssues !== undefined && { resolved: msg.payload.resolvedIssues }),
        ...(msg.payload.fixPrompt   !== undefined && { fixPrompt: msg.payload.fixPrompt }),
        scanning: false, oauthWaiting: false, error: null,
      });
      if (msg.payload.fixPrompt) openFixModal(msg.payload.fixPrompt);
      break;
    case 'scanProgress':
      set({ scanning: true, progress: msg.payload });
      // Detect if we're waiting for OAuth browser
      if (msg.payload.message && msg.payload.message.includes('browser')) {
        set({ oauthWaiting: true, scanning: false });
      }
      break;
    case 'scanComplete':
      set({ scanning: false, oauthWaiting: false, scan: msg.payload, error: null });
      break;
    case 'authSuccess':
      set({ auth: msg.payload, oauthWaiting: false, error: null });
      break;
    case 'authError':
      set({ error: msg.payload, oauthWaiting: false, scanning: false });
      break;
    case 'error':
      set({ scanning: false, oauthWaiting: false, error: msg.payload });
      break;
  }
});

// ── Actions ──────────────────────────────────────────────────────────────────
function post(type, payload) { vscode.postMessage({ type, payload }); }

function oauthSignIn(provider) {
  set({ oauthWaiting: true, oauthProvider: provider, error: null });
  post('signIn', { provider });
}

function demoSignIn() {
  set({ oauthWaiting: true, error: null });
  post('signInDemo', { email: 'demo@securescan.dev' });
}

function signOut() { post('signOut'); }
function scan() { set({ scanning: true, error: null }); post('scan'); }
function rescan() { set({ scanning: true, error: null }); post('rescan'); }
function openFile(file, line) { post('openFile', { file, line }); }
function markResolved(id) { post('markResolved', { ruleId: id }); }
function generateFix(id) { post('generateFix', { ruleId: id }); }
function setTab(t) { set({ tab: t }); }

// ── Fix Modal ─────────────────────────────────────────────────────────────────
function openFixModal(fix) {
  document.getElementById('fixModalTitle').textContent = 'AI Fix — ' + (fix.issueId ?? '');
  document.getElementById('fixModalBody').innerHTML =
    '<div class="sec-lbl">Explanation</div>' +
    '<p style="font-size:12px;color:var(--muted);margin-bottom:10px;">' + esc(fix.explanation) + '</p>' +
    '<div class="sec-lbl">Remediation Plan</div>' +
    '<p style="font-size:12px;color:var(--muted);margin-bottom:10px;">' + esc(fix.remediationPlan) + '</p>' +
    '<div class="sec-lbl">Copy-Ready Prompt</div>' +
    '<div class="prompt-box" id="promptBox">' + esc(fix.copyablePrompt) + '</div>' +
    '<button class="btn btn-primary" style="margin-top:8px;" onclick="copyPrompt()">📋 Copy Prompt</button>';
  document.getElementById('fixModal').classList.add('open');
}
function closeFixModal() { document.getElementById('fixModal').classList.remove('open'); }
function copyPrompt() {
  const box = document.getElementById('promptBox');
  if (box) { navigator.clipboard.writeText(box.textContent ?? ''); showToast('✓ Copied!'); }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.opacity = '1';
  setTimeout(() => { t.style.opacity = '0'; }, 2400);
}
function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function shortPath(p) {
  const parts = p.replace(/\\\\/g,'/').split('/');
  return parts.length > 3 ? '.../' + parts.slice(-2).join('/') : p;
}
function scoreColor(n) {
  return n >= 80 ? '#3fb950' : n >= 60 ? '#f59e0b' : n >= 40 ? '#f97316' : '#f85149';
}
function sevIcon(s) {
  return { critical:'🔴', high:'🟠', medium:'🟡', low:'🔵', info:'⚪' }[s] ?? '⚫';
}
function providerLabel(p) {
  return { google: 'Google', github: 'GitHub' }[p] ?? p;
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function render() {
  const root = document.getElementById('root');
  if (!root) return;

  if (!S.auth.isAuthenticated) {
    root.innerHTML = S.oauthWaiting ? renderOAuthWaiting() : renderAuth();
    return;
  }

  root.innerHTML =
    renderUserCard() +
    renderTabs() +
    renderTabContent();

  document.querySelectorAll('.issue-hdr').forEach(el => {
    el.addEventListener('click', () => el.closest('.issue-item').classList.toggle('open'));
  });
}

// ── Auth Screen ───────────────────────────────────────────────────────────────
function renderAuth() {
  return \`
    <div class="card">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:36px;margin-bottom:10px;">🛡️</div>
        <div style="font-size:15px;font-weight:700;margin-bottom:4px;">Sign in to SecureScan</div>
        <div style="font-size:12px;color:var(--muted);">Scan your codebase for security vulnerabilities</div>
      </div>

      \${S.error ? \`<div style="color:var(--critical);font-size:12px;padding:8px 10px;background:rgba(248,81,73,.08);border:1px solid rgba(248,81,73,.2);border-radius:var(--rs);margin-bottom:12px;">\${esc(S.error)}</div>\` : ''}

      <!-- Google -->
      <button class="oauth-btn" onclick="oauthSignIn('google')">
        <svg class="oauth-icon" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>

      <!-- GitHub -->
      <button class="oauth-btn" onclick="oauthSignIn('github')">
        <svg class="oauth-icon" viewBox="0 0 24 24" fill="var(--text)">
          <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
        </svg>
        Continue with GitHub
      </button>

      <!-- Vercel (uses GitHub) -->
      <button class="oauth-btn" onclick="oauthSignIn('github')" style="border-style:dashed;opacity:.8;">
        <svg class="oauth-icon" viewBox="0 0 24 24" fill="var(--text)">
          <path d="M24 22.525H0l12-21.05 12 21.05z"/>
        </svg>
        Continue with Vercel <span style="font-size:10px;color:var(--muted);">(via GitHub)</span>
      </button>

      <div class="divider">or</div>

      <button class="btn btn-ghost" style="width:100%;justify-content:center;font-size:11px;color:var(--muted);"
        onclick="demoSignIn()">
        Try Demo Mode (no auth required)
      </button>
    </div>
  \`;
}

function renderOAuthWaiting() {
  const provider = S.oauthProvider ? providerLabel(S.oauthProvider) : 'provider';
  return \`
    <div class="card">
      <div class="waiting-box">
        <div class="spinner"></div>
        <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px;">
          Waiting for \${provider} sign-in...
        </div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:14px;">
          A browser window has opened. Complete sign-in there and you'll be redirected back automatically.
        </div>
        <button class="btn btn-secondary btn-sm" onclick="cancelOAuth()">Cancel</button>
      </div>
    </div>
  \`;
}

function cancelOAuth() {
  set({ oauthWaiting: false, oauthProvider: null });
}

// ── User Card ─────────────────────────────────────────────────────────────────
function renderUserCard() {
  const u = S.auth.user;
  const initials = u
    ? ((u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '') || u.email?.[0]?.toUpperCase() || '?')
    : '?';
  const name = u
    ? ((u.firstName || '') + ' ' + (u.lastName || '')).trim() || u.email
    : 'User';
  return \`
    <div class="user-card">
      <div class="avatar">
        \${u?.imageUrl
          ? \`<img src="\${esc(u.imageUrl)}" alt="" />\`
          : initials}
      </div>
      <div class="u-info">
        <div class="u-name">\${esc(String(name ?? ''))}</div>
        <div class="u-email">\${esc(u?.email ?? '')}</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="signOut()">Sign out</button>
    </div>
  \`;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function renderTabs() {
  const issueCount = S.scan ? \` (\${S.scan.issues.length})\` : '';
  return \`
    <div class="tabs">
      <div class="tab \${S.tab==='dashboard'?'active':''}" onclick="setTab('dashboard')">Dashboard</div>
      <div class="tab \${S.tab==='issues'?'active':''}" onclick="setTab('issues')">Issues\${issueCount}</div>
      <div class="tab \${S.tab==='checklist'?'active':''}" onclick="setTab('checklist')">Checklist</div>
    </div>
  \`;
}

function renderTabContent() {
  switch (S.tab) {
    case 'dashboard':  return renderDashboard();
    case 'issues':     return renderIssues();
    case 'checklist':  return renderChecklist();
    default: return '';
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function renderDashboard() {
  const r = S.scan;
  return \`
    \${S.error ? \`<div class="card" style="border-color:rgba(248,81,73,.3);background:rgba(248,81,73,.05);">
      <div style="color:var(--critical);font-size:12px;">⚠ \${esc(S.error)}</div>
    </div>\` : ''}

    \${S.scanning ? renderProgress() : ''}

    \${r ? renderScoreCard() : ''}

    \${!r && !S.scanning ? \`
      <div class="empty">
        <div class="empty-icon">🛡️</div>
        <div class="empty-title">Ready to Scan</div>
        <div style="font-size:12px;">Click Scan Project to analyze your codebase for vulnerabilities.</div>
      </div>
    \` : ''}

    <div style="display:flex;gap:6px;margin-top:8px;">
      \${!r
        ? \`<button class="btn btn-primary" onclick="scan()" \${S.scanning?'disabled':''}>🔍 Scan Project</button>\`
        : \`<button class="btn btn-primary" onclick="rescan()" \${S.scanning?'disabled':''}
              style="flex:1;">🔄 Rescan</button>
           <button class="btn btn-secondary" onclick="scan()" \${S.scanning?'disabled':''}
              style="flex:1;">🔍 Full Scan</button>\`}
    </div>

    \${r ? \`<div class="scan-meta">
      <span>🕐 \${new Date(r.timestamp).toLocaleTimeString()}</span>
      <span>📁 \${r.fileCount} files</span>
      <span>📝 \${r.linesScanned.toLocaleString()} lines</span>
      <span>⚡ \${(r.duration/1000).toFixed(1)}s</span>
    </div>\` : ''}
  \`;
}

function renderProgress() {
  const p = S.progress;
  return \`
    <div class="card">
      <div class="progress-wrap">
        <div class="progress-msg">\${esc(p.message || 'Scanning...')}</div>
        <div class="progress-bg">
          <div class="progress-fill" style="width:\${p.percent??0}%"></div>
        </div>
        <div style="text-align:right;font-size:10px;color:var(--muted);margin-top:3px;">\${p.percent??0}%</div>
      </div>
    </div>
  \`;
}

function renderScoreCard() {
  const r = S.scan; const s = r.score;
  const color = scoreColor(s.total);
  const C = 2 * Math.PI * 42;
  const offset = C - (s.total / 100) * C;
  return \`
    <div class="card">
      <div class="card-header">
        <span class="card-title">Security Score</span>
        <span class="fw-badge">📦 \${r.framework}</span>
      </div>
      <div class="score-container">
        <div class="score-ring">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle class="track" cx="50" cy="50" r="42"/>
            <circle class="fill" cx="50" cy="50" r="42"
              stroke="\${color}" stroke-dasharray="\${C}" stroke-dashoffset="\${offset}"/>
          </svg>
          <div class="score-number">
            <span class="score-value" style="color:\${color}">\${s.total}</span>
            <span class="score-sub">/ 100</span>
          </div>
        </div>
        <div class="score-grade" style="background:\${color}22;color:\${color};border:1px solid \${color}44;">
          Grade \${s.grade}
        </div>
      </div>
      <div class="stats-row">
        <div class="stat c"><div class="stat-v">\${s.breakdown.critical}</div><div class="stat-k">Critical</div></div>
        <div class="stat h"><div class="stat-v">\${s.breakdown.high}</div><div class="stat-k">High</div></div>
        <div class="stat m"><div class="stat-v">\${s.breakdown.medium}</div><div class="stat-k">Medium</div></div>
        <div class="stat l"><div class="stat-v">\${s.breakdown.low}</div><div class="stat-k">Low</div></div>
      </div>
    </div>
  \`;
}

// ── Issues ────────────────────────────────────────────────────────────────────
function renderIssues() {
  const r = S.scan;
  if (!r) return \`<div class="empty"><div class="empty-icon">🔍</div><div class="empty-title">No Scan Yet</div><div>Run a scan to see issues.</div></div>\`;
  if (!r.issues.length) return \`<div class="empty"><div class="empty-icon">✅</div><div class="empty-title">All Clear!</div><div>No issues found.</div></div>\`;

  const sorted = [...r.issues].sort((a,b) => {
    const o = {critical:0,high:1,medium:2,low:3,info:4};
    return (o[a.severity]??5) - (o[b.severity]??5);
  });

  return \`
    <div style="font-size:11px;color:var(--muted);margin-bottom:8px;">
      \${sorted.length} issue\${sorted.length!==1?'s':''} · \${S.resolved.length} resolved
    </div>
    \${sorted.map(issue => {
      const res = S.resolved.includes(issue.ruleId);
      return \`
        <div class="issue-item \${res?'resolved':''}">
          <div class="issue-hdr">
            <span>\${res?'✅':sevIcon(issue.severity)}</span>
            <span class="issue-title">\${esc(issue.title)}</span>
            <span class="badge badge-\${issue.severity}">\${issue.severity}</span>
            <span class="issue-chev">▶</span>
          </div>
          <div class="issue-body">
            <p class="issue-desc">\${esc(issue.description)}</p>
            \${issue.attackScenario ? \`<div class="atk"><strong>⚠ Attack Scenario</strong>\${esc(issue.attackScenario)}</div>\` : ''}
            <div class="sec-lbl">Affected Files (\${issue.locations.length})</div>
            \${issue.locations.slice(0,8).map(loc => \`
              <div class="loc" onclick="openFile('\${esc(loc.file)}',\${loc.line})">
                <span>📄</span>
                <span class="loc-file">\${esc(shortPath(loc.file))}</span>
                <span class="loc-line">line \${loc.line}</span>
              </div>
            \`).join('')}
            \${issue.locations.length>8 ? \`<div style="font-size:10px;color:var(--muted);padding:4px 8px;">+\${issue.locations.length-8} more</div>\` : ''}
            <div class="sec-lbl">Remediation</div>
            <p style="font-size:12px;color:var(--muted);">\${esc(issue.remediationGuidance)}</p>
            <div class="issue-actions">
              <button class="btn btn-secondary btn-sm" onclick="generateFix('\${issue.ruleId}')">🤖 AI Fix Prompt</button>
              \${!res
                ? \`<button class="btn btn-ghost btn-sm" onclick="markResolved('\${issue.ruleId}')">✓ Mark Resolved</button>\`
                : \`<span style="font-size:11px;color:var(--success);">✅ Marked — rescan to verify</span>\`}
            </div>
          </div>
        </div>
      \`;
    }).join('')}
  \`;
}

// ── Checklist ─────────────────────────────────────────────────────────────────
function renderChecklist() {
  const r = S.scan;
  if (!r) return \`<div class="empty"><div class="empty-icon">📋</div><div class="empty-title">No Checklist</div><div>Run a scan first.</div></div>\`;

  const issueIds = new Set(r.issues.map(i => i.ruleId));
  const color = scoreColor(r.score.total);

  const passed = [
    ['missing_helmet',           'Security Headers (Helmet)'],
    ['missing_rate_limiting',    'Rate Limiting'],
    ['open_cors',                'CORS Policy'],
    ['missing_input_validation', 'Input Validation'],
    ['hardcoded_secrets',        'Secrets Management'],
    ['exposed_api_key',          'API Key Safety'],
    ['unsafe_jwt',               'JWT Security'],
    ['insecure_cookies',         'Cookie Security'],
    ['sql_injection_risk',       'SQL Injection Protection'],
    ['xss_risk',                 'XSS Protection'],
    ['path_traversal',           'Path Traversal Protection'],
  ].filter(([id]) => !issueIds.has(id)).map(([,label]) => label);

  const failed = r.issues.filter(i => !S.resolved.includes(i.ruleId));
  const resolvedItems = r.issues.filter(i => S.resolved.includes(i.ruleId));

  return \`
    <div style="font-size:12px;color:var(--muted);margin-bottom:10px;">
      Score: <strong style="color:\${color}">\${r.score.total}/100</strong> — Grade <strong>\${r.score.grade}</strong>
    </div>
    \${passed.length ? \`
      <div class="section-title">✅ Passing (\${passed.length})</div>
      \${passed.map(l => \`<div class="check-item"><span class="check-icon" style="color:var(--success)">✓</span><span>\${esc(l)}</span></div>\`).join('')}
    \` : ''}
    \${failed.length ? \`
      <div class="section-title">❌ Issues Found (\${failed.length})</div>
      \${failed.map(i => \`
        <div class="check-item" onclick="setTab('issues')" style="cursor:pointer;">
          <span class="check-icon">❌</span>
          <span style="flex:1;">\${esc(i.title)}</span>
          <span class="badge badge-\${i.severity}">\${i.severity}</span>
        </div>
      \`).join('')}
    \` : ''}
    \${resolvedItems.length ? \`
      <div class="section-title">🔄 Marked Resolved (\${resolvedItems.length})</div>
      \${resolvedItems.map(i => \`
        <div class="check-item">
          <span class="check-icon" style="color:var(--muted)">○</span>
          <span class="check-resolved">\${esc(i.title)}</span>
          <span style="font-size:10px;color:var(--muted);margin-left:4px;">pending rescan</span>
        </div>
      \`).join('')}
      <div style="margin-top:8px;">
        <button class="btn btn-secondary btn-sm" onclick="rescan()">🔄 Rescan to Verify</button>
      </div>
    \` : ''}
  \`;
}

// ── Init ──────────────────────────────────────────────────────────────────────
render();
post('ready');
</script>
</body>
</html>`;
}
