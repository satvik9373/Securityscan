import * as vscode from 'vscode';

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
  <title>SecureScan</title>
  <style>
    /* ── Reset & Base ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: var(--vscode-sideBar-background, #0d1117);
      --bg-card: var(--vscode-editor-background, #161b22);
      --bg-input: var(--vscode-input-background, #1c2128);
      --border: var(--vscode-panel-border, #30363d);
      --text: var(--vscode-foreground, #e6edf3);
      --text-muted: var(--vscode-descriptionForeground, #7d8590);
      --accent: var(--vscode-button-background, #238636);
      --accent-hover: var(--vscode-button-hoverBackground, #2ea043);
      --critical: #f85149;
      --high: #f97316;
      --medium: #f59e0b;
      --low: #58a6ff;
      --info: #7d8590;
      --success: #3fb950;
      --radius: 8px;
      --radius-sm: 5px;
    }

    html, body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);
      font-size: 13px;
      line-height: 1.5;
      height: 100%;
      overflow-x: hidden;
    }

    #app { padding: 12px; min-height: 100vh; }

    /* ── Buttons ── */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 14px;
      border: none;
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      text-decoration: none;
      white-space: nowrap;
    }
    .btn-primary { background: var(--accent); color: #fff; width: 100%; justify-content: center; }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-secondary { background: transparent; color: var(--text); border: 1px solid var(--border); }
    .btn-secondary:hover { background: var(--bg-card); }
    .btn-ghost { background: transparent; color: var(--text-muted); border: none; padding: 4px 8px; font-size: 11px; }
    .btn-ghost:hover { color: var(--text); }
    .btn-danger { background: rgba(248,81,73,0.1); color: var(--critical); border: 1px solid rgba(248,81,73,0.2); }
    .btn-danger:hover { background: rgba(248,81,73,0.2); }
    .btn-sm { padding: 4px 10px; font-size: 11px; }
    .btn-icon { padding: 6px; min-width: 28px; justify-content: center; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── Cards ── */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 14px;
      margin-bottom: 10px;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .card-title {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }

    /* ── Form ── */
    .form-group { margin-bottom: 10px; }
    .form-label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 5px; }
    .form-input {
      width: 100%;
      padding: 8px 10px;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      color: var(--text);
      font-size: 13px;
      outline: none;
      transition: border-color 0.15s;
    }
    .form-input:focus { border-color: var(--accent); }
    .form-error { color: var(--critical); font-size: 11px; margin-top: 6px; }

    /* ── Score Ring ── */
    .score-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 0;
    }
    .score-ring { position: relative; width: 100px; height: 100px; }
    .score-ring svg { transform: rotate(-90deg); }
    .score-ring circle { fill: none; stroke-width: 8; stroke-linecap: round; }
    .score-ring .track { stroke: var(--border); }
    .score-ring .fill { transition: stroke-dashoffset 0.8s ease; }
    .score-number {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .score-value { font-size: 26px; font-weight: 700; line-height: 1; }
    .score-label { font-size: 10px; color: var(--text-muted); margin-top: 2px; }
    .score-grade {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 20px;
      margin-top: 8px;
    }

    /* ── Stats Row ── */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin-top: 12px;
    }
    .stat-item {
      text-align: center;
      padding: 8px 4px;
      border-radius: var(--radius-sm);
      background: rgba(255,255,255,0.03);
    }
    .stat-value { font-size: 18px; font-weight: 700; }
    .stat-key { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
    .stat-critical .stat-value { color: var(--critical); }
    .stat-high .stat-value { color: var(--high); }
    .stat-medium .stat-value { color: var(--medium); }
    .stat-low .stat-value { color: var(--low); }

    /* ── Severity Badge ── */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 7px;
      border-radius: 20px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .badge-critical { background: rgba(248,81,73,0.15); color: var(--critical); border: 1px solid rgba(248,81,73,0.3); }
    .badge-high { background: rgba(249,115,22,0.15); color: var(--high); border: 1px solid rgba(249,115,22,0.3); }
    .badge-medium { background: rgba(245,158,11,0.15); color: var(--medium); border: 1px solid rgba(245,158,11,0.3); }
    .badge-low { background: rgba(88,166,255,0.15); color: var(--low); border: 1px solid rgba(88,166,255,0.3); }
    .badge-info { background: rgba(125,133,144,0.15); color: var(--info); border: 1px solid rgba(125,133,144,0.3); }

    /* ── Issue List ── */
    .issue-item {
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      margin-bottom: 6px;
      overflow: hidden;
      transition: border-color 0.15s;
    }
    .issue-item.resolved { opacity: 0.5; }
    .issue-item:hover { border-color: rgba(255,255,255,0.15); }
    .issue-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      cursor: pointer;
      user-select: none;
    }
    .issue-icon { flex-shrink: 0; font-size: 14px; }
    .issue-title { flex: 1; font-size: 12px; font-weight: 500; }
    .issue-chevron { color: var(--text-muted); font-size: 10px; transition: transform 0.2s; }
    .issue-item.open .issue-chevron { transform: rotate(90deg); }
    .issue-body {
      display: none;
      padding: 0 12px 12px;
      border-top: 1px solid var(--border);
    }
    .issue-item.open .issue-body { display: block; }
    .issue-description { color: var(--text-muted); font-size: 12px; margin: 10px 0; }
    .issue-section-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin: 10px 0 5px;
    }
    .location-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 5px 8px;
      background: rgba(255,255,255,0.03);
      border-radius: var(--radius-sm);
      margin-bottom: 3px;
      cursor: pointer;
      font-size: 11px;
      font-family: monospace;
      transition: background 0.1s;
    }
    .location-item:hover { background: rgba(255,255,255,0.08); }
    .location-file { color: var(--low); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .location-line { color: var(--text-muted); flex-shrink: 0; }
    .issue-actions { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
    .attack-box {
      background: rgba(248,81,73,0.06);
      border: 1px solid rgba(248,81,73,0.15);
      border-radius: var(--radius-sm);
      padding: 8px 10px;
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 8px;
    }
    .attack-box strong { color: var(--critical); display: block; margin-bottom: 3px; }

    /* ── Fix Prompt Modal ── */
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.6);
      z-index: 100;
      align-items: flex-start;
      justify-content: center;
      padding: 20px;
    }
    .modal-overlay.open { display: flex; }
    .modal {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      width: 100%;
      max-height: 80vh;
      overflow-y: auto;
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid var(--border);
    }
    .modal-title { font-size: 13px; font-weight: 600; }
    .modal-body { padding: 14px 16px; }
    .prompt-box {
      background: rgba(0,0,0,0.3);
      border: 1px solid var(--border);
      border-radius: var(--radius-sm);
      padding: 10px;
      font-size: 11px;
      font-family: monospace;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--text);
      max-height: 300px;
      overflow-y: auto;
      margin: 8px 0;
    }

    /* ── Progress Bar ── */
    .progress-container { margin: 10px 0; }
    .progress-message { font-size: 11px; color: var(--text-muted); margin-bottom: 5px; }
    .progress-bar-bg {
      height: 4px;
      background: var(--border);
      border-radius: 2px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      border-radius: 2px;
      background: var(--accent);
      transition: width 0.3s ease;
    }

    /* ── Tabs ── */
    .tabs { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 12px; }
    .tab {
      padding: 8px 14px;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-muted);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.15s;
    }
    .tab.active { color: var(--text); border-bottom-color: var(--accent); }
    .tab:hover:not(.active) { color: var(--text); }

    /* ── User Profile ── */
    .user-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: rgba(255,255,255,0.03);
      border-radius: var(--radius-sm);
      border: 1px solid var(--border);
    }
    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--accent);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
      flex-shrink: 0;
      overflow: hidden;
    }
    .user-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .user-info { flex: 1; min-width: 0; }
    .user-name { font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .user-email { font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* ── Section Divider ── */
    .section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin: 14px 0 8px;
      padding-bottom: 5px;
      border-bottom: 1px solid var(--border);
    }

    /* ── Empty State ── */
    .empty-state {
      text-align: center;
      padding: 28px 16px;
      color: var(--text-muted);
    }
    .empty-icon { font-size: 36px; margin-bottom: 10px; }
    .empty-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 5px; }
    .empty-desc { font-size: 12px; }

    /* ── Toast ── */
    .toast {
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: #1f2937;
      border: 1px solid var(--border);
      padding: 8px 16px;
      border-radius: var(--radius-sm);
      font-size: 12px;
      z-index: 200;
      transition: opacity 0.3s;
      pointer-events: none;
    }

    /* ── Framework Badge ── */
    .fw-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 20px;
      font-size: 11px;
      background: rgba(88,166,255,0.1);
      color: var(--low);
      border: 1px solid rgba(88,166,255,0.2);
    }

    /* ── Logo ── */
    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 14px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    .logo-icon { font-size: 20px; }
    .logo-text { font-size: 15px; font-weight: 700; letter-spacing: -0.02em; }
    .logo-beta {
      font-size: 9px;
      font-weight: 600;
      padding: 1px 5px;
      border-radius: 3px;
      background: rgba(88,166,255,0.15);
      color: var(--low);
      border: 1px solid rgba(88,166,255,0.25);
    }

    /* ── Checklist Item ── */
    .check-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      font-size: 12px;
    }
    .check-icon { font-size: 14px; flex-shrink: 0; }
    .check-label { flex: 1; }
    .check-resolved { text-decoration: line-through; color: var(--text-muted); }

    .scan-meta {
      display: flex;
      gap: 12px;
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 8px;
      flex-wrap: wrap;
    }
    .scan-meta span { display: flex; align-items: center; gap: 3px; }

    .generating { color: var(--text-muted); font-size: 12px; display: flex; align-items: center; gap: 6px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; }

    .pill-group { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
    .pill { font-size: 10px; padding: 2px 6px; border-radius: 20px; background: rgba(255,255,255,0.05); color: var(--text-muted); border: 1px solid var(--border); }
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

<!-- Fix Prompt Modal -->
<div class="modal-overlay" id="fixModal">
  <div class="modal">
    <div class="modal-header">
      <span class="modal-title" id="fixModalTitle">AI Fix Prompt</span>
      <button class="btn btn-ghost btn-icon" onclick="closeFixModal()">✕</button>
    </div>
    <div class="modal-body" id="fixModalBody"></div>
  </div>
</div>

<div class="toast" id="toast" style="opacity:0"></div>

<script>
const vscode = acquireVsCodeApi();

// ── State ──────────────────────────────────────────────────────────────
let state = {
  authState: { isAuthenticated: false, user: null, sessionToken: null },
  scanResult: null,
  resolvedIssues: [],
  scanning: false,
  scanProgress: { message: '', percent: 0 },
  fixPrompt: null,
  activeTab: 'dashboard',
  openIssue: null,
  error: null,
};

function setState(patch) {
  state = { ...state, ...patch };
  render();
}

// ── Message Handling ─────────────────────────────────────────────────
window.addEventListener('message', ev => {
  const msg = ev.data;
  switch (msg.type) {
    case 'updateState':
      setState({
        ...(msg.payload.authState !== undefined && { authState: msg.payload.authState }),
        ...(msg.payload.scanResult !== undefined && { scanResult: msg.payload.scanResult }),
        ...(msg.payload.resolvedIssues !== undefined && { resolvedIssues: msg.payload.resolvedIssues }),
        ...(msg.payload.fixPrompt !== undefined && { fixPrompt: msg.payload.fixPrompt }),
        scanning: false,
      });
      if (msg.payload.fixPrompt) {
        openFixModal(msg.payload.fixPrompt);
      }
      break;
    case 'scanProgress':
      setState({ scanning: true, scanProgress: msg.payload });
      break;
    case 'scanComplete':
      setState({ scanning: false, scanResult: msg.payload, error: null });
      break;
    case 'authSuccess':
      setState({ authState: msg.payload, error: null });
      break;
    case 'authError':
      setState({ error: msg.payload });
      break;
    case 'error':
      setState({ scanning: false, error: msg.payload });
      break;
  }
});

// ── Post Messages ─────────────────────────────────────────────────────
function post(type, payload) { vscode.postMessage({ type, payload }); }

function scan() { setState({ scanning: true, error: null }); post('scan'); }
function rescan() { setState({ scanning: true, error: null }); post('rescan'); }
function signOut() { post('signOut'); }
function openFile(file, line) { post('openFile', { file, line }); }
function markResolved(ruleId) { post('markResolved', { ruleId }); }
function generateFix(ruleId) {
  showGenerating(ruleId);
  post('generateFix', { ruleId });
}

function showGenerating(ruleId) {
  document.getElementById('fix-btn-' + ruleId)?.setAttribute('disabled', 'true');
}

// ── Tabs ─────────────────────────────────────────────────────────────
function setTab(tab) { setState({ activeTab: tab }); }

// ── Fix Modal ─────────────────────────────────────────────────────────
function openFixModal(fix) {
  const modal = document.getElementById('fixModal');
  const title = document.getElementById('fixModalTitle');
  const body = document.getElementById('fixModalBody');
  title.textContent = 'AI Fix Prompt — ' + (fix.issueId ?? '');
  body.innerHTML = \`
    <div class="issue-section-label">Explanation</div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">\${esc(fix.explanation)}</p>
    <div class="issue-section-label">Remediation Plan</div>
    <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">\${esc(fix.remediationPlan)}</p>
    <div class="issue-section-label">Copy-Ready Prompt</div>
    <div class="prompt-box" id="promptBox">\${esc(fix.copyablePrompt)}</div>
    <button class="btn btn-primary" style="margin-top:8px;" onclick="copyPrompt()">📋 Copy Prompt</button>
  \`;
  modal.classList.add('open');
}

function closeFixModal() {
  document.getElementById('fixModal').classList.remove('open');
}

function copyPrompt() {
  const box = document.getElementById('promptBox');
  if (box) {
    navigator.clipboard.writeText(box.textContent ?? '').catch(() => {});
    showToast('Prompt copied to clipboard!');
  }
}

// ── Toast ─────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.opacity = '1';
  setTimeout(() => { t.style.opacity = '0'; }, 2500);
}

// ── Escape HTML ───────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shortPath(full) {
  const parts = full.replace(/\\\\/g, '/').split('/');
  return parts.length > 3 ? '.../' + parts.slice(-2).join('/') : full;
}

// ── Severity Color ────────────────────────────────────────────────────
function scoreColor(n) {
  if (n >= 80) return '#3fb950';
  if (n >= 60) return '#f59e0b';
  if (n >= 40) return '#f97316';
  return '#f85149';
}

// ── Render ─────────────────────────────────────────────────────────────
function render() {
  const root = document.getElementById('root');
  if (!root) return;

  if (!state.authState.isAuthenticated) {
    root.innerHTML = renderAuth();
    return;
  }

  root.innerHTML = \`
    \${renderUserCard()}
    \${renderTabs()}
    \${renderTabContent()}
  \`;

  // Re-attach expand listeners
  document.querySelectorAll('.issue-header').forEach(el => {
    el.addEventListener('click', () => {
      el.closest('.issue-item').classList.toggle('open');
    });
  });
}

// ── Auth View ─────────────────────────────────────────────────────────
function renderAuth() {
  return \`
    <div class="card">
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:32px;margin-bottom:8px;">🔐</div>
        <div style="font-size:14px;font-weight:600;margin-bottom:4px;">Sign in to SecureScan</div>
        <div style="font-size:12px;color:var(--text-muted);">Scan your codebase for security vulnerabilities</div>
      </div>
      \${state.error ? \`<div class="form-error" style="margin-bottom:10px;padding:8px;background:rgba(248,81,73,0.1);border-radius:4px;">\${esc(state.error)}</div>\` : ''}
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" type="email" id="authEmail" placeholder="you@example.com" />
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input class="form-input" type="password" id="authPassword" placeholder="••••••••" onkeydown="if(event.key==='Enter')doSignIn()" />
      </div>
      <button class="btn btn-primary" onclick="doSignIn()" style="margin-top:4px;">Sign In</button>
      <div style="text-align:center;margin-top:10px;font-size:11px;color:var(--text-muted);">
        Powered by <strong>Clerk</strong> authentication
      </div>
    </div>
    <div class="card" style="border-style:dashed;text-align:center;">
      <div style="font-size:11px;color:var(--text-muted);">
        <strong style="color:var(--text);">Demo mode:</strong> Use any email + password to explore the UI.<br/>
        Configure <code>CLERK_PUBLISHABLE_KEY</code> in settings for real auth.
      </div>
      <button class="btn btn-secondary" style="margin-top:10px;font-size:11px;" onclick="doDemoSignIn()">
        Try Demo
      </button>
    </div>
  \`;
}

function doSignIn() {
  const email = document.getElementById('authEmail')?.value ?? '';
  const password = document.getElementById('authPassword')?.value ?? '';
  if (!email || !password) { setState({ error: 'Please enter email and password.' }); return; }
  setState({ error: null });
  post('signIn', { email, password });
}

function doDemoSignIn() {
  post('signIn', { email: 'demo@securescan.dev', password: 'demo123' });
}

// ── User Card ─────────────────────────────────────────────────────────
function renderUserCard() {
  const u = state.authState.user;
  const initials = u ? ((u.firstName?.[0] ?? '') + (u.lastName?.[0] ?? '') || u.email?.[0]?.toUpperCase() || '?') : '?';
  const name = u ? ((u.firstName || '') + ' ' + (u.lastName || '')).trim() || u.email : 'User';
  return \`
    <div class="user-card" style="margin-bottom:12px;">
      <div class="user-avatar">
        \${u?.imageUrl ? \`<img src="\${esc(u.imageUrl)}" />\` : initials}
      </div>
      <div class="user-info">
        <div class="user-name">\${esc(name)}</div>
        <div class="user-email">\${esc(u?.email ?? '')}</div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="signOut()">Sign out</button>
    </div>
  \`;
}

// ── Tabs ─────────────────────────────────────────────────────────────
function renderTabs() {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'issues', label: 'Issues' + (state.scanResult ? \` (\${state.scanResult.issues.length})\` : '') },
    { id: 'checklist', label: 'Checklist' },
  ];
  return \`
    <div class="tabs">
      \${tabs.map(t => \`<div class="tab \${state.activeTab === t.id ? 'active' : ''}" onclick="setTab('\${t.id}')">\${t.label}</div>\`).join('')}
    </div>
  \`;
}

function renderTabContent() {
  switch (state.activeTab) {
    case 'dashboard': return renderDashboard();
    case 'issues': return renderIssues();
    case 'checklist': return renderChecklist();
    default: return '';
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────
function renderDashboard() {
  const r = state.scanResult;
  return \`
    \${state.error ? \`<div class="card" style="border-color:rgba(248,81,73,0.3);background:rgba(248,81,73,0.05);">
      <div style="color:var(--critical);font-size:12px;">⚠ \${esc(state.error)}</div>
    </div>\` : ''}

    \${state.scanning ? renderProgress() : ''}

    \${r ? renderScoreCard() : ''}

    \${!r && !state.scanning ? renderWelcome() : ''}

    <div style="display:flex;gap:6px;margin-top:8px;">
      \${!r ? \`<button class="btn btn-primary" onclick="scan()" \${state.scanning ? 'disabled' : ''}>
        🔍 Scan Project
      </button>\` : \`
      <button class="btn btn-primary" onclick="rescan()" \${state.scanning ? 'disabled' : ''} style="flex:1;">
        🔄 Rescan
      </button>
      <button class="btn btn-secondary" onclick="scan()" \${state.scanning ? 'disabled' : ''} style="flex:1;">
        🔍 Full Scan
      </button>
      \`}
    </div>

    \${r ? renderScanMeta() : ''}
  \`;
}

function renderWelcome() {
  return \`
    <div class="empty-state">
      <div class="empty-icon">🛡️</div>
      <div class="empty-title">Ready to Scan</div>
      <div class="empty-desc">Click Scan Project to analyze your codebase for security vulnerabilities.</div>
    </div>
  \`;
}

function renderProgress() {
  const p = state.scanProgress;
  return \`
    <div class="card">
      <div class="progress-container">
        <div class="progress-message">\${esc(p.message || 'Scanning...')}</div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:\${p.percent ?? 0}%"></div>
        </div>
        <div style="text-align:right;font-size:10px;color:var(--text-muted);margin-top:3px;">\${p.percent ?? 0}%</div>
      </div>
    </div>
  \`;
}

function renderScoreCard() {
  const r = state.scanResult;
  const s = r.score;
  const color = scoreColor(s.total);
  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (s.total / 100) * circumference;

  return \`
    <div class="card">
      <div class="card-header">
        <span class="card-title">Security Score</span>
        <span class="fw-badge">📦 \${r.framework}</span>
      </div>
      <div class="score-container">
        <div class="score-ring">
          <svg width="100" height="100" viewBox="0 0 100 100">
            <circle class="track" cx="50" cy="50" r="42" />
            <circle class="fill" cx="50" cy="50" r="42"
              stroke="\${color}"
              stroke-dasharray="\${circumference}"
              stroke-dashoffset="\${offset}" />
          </svg>
          <div class="score-number">
            <span class="score-value" style="color:\${color}">\${s.total}</span>
            <span class="score-label">/ 100</span>
          </div>
        </div>
        <div class="score-grade" style="background:\${color}22;color:\${color};border:1px solid \${color}44;">
          Grade \${s.grade}
        </div>
      </div>
      <div class="stats-row">
        <div class="stat-item stat-critical">
          <div class="stat-value">\${s.breakdown.critical}</div>
          <div class="stat-key">Critical</div>
        </div>
        <div class="stat-item stat-high">
          <div class="stat-value">\${s.breakdown.high}</div>
          <div class="stat-key">High</div>
        </div>
        <div class="stat-item stat-medium">
          <div class="stat-value">\${s.breakdown.medium}</div>
          <div class="stat-key">Medium</div>
        </div>
        <div class="stat-item stat-low">
          <div class="stat-value">\${s.breakdown.low}</div>
          <div class="stat-key">Low</div>
        </div>
      </div>
    </div>
  \`;
}

function renderScanMeta() {
  const r = state.scanResult;
  const ts = new Date(r.timestamp).toLocaleTimeString();
  return \`
    <div class="scan-meta" style="margin-top:6px;">
      <span>🕐 \${ts}</span>
      <span>📁 \${r.fileCount} files</span>
      <span>📝 \${r.linesScanned.toLocaleString()} lines</span>
      <span>⚡ \${(r.duration / 1000).toFixed(1)}s</span>
    </div>
  \`;
}

// ── Issues ─────────────────────────────────────────────────────────────
function renderIssues() {
  const r = state.scanResult;
  if (!r) {
    return \`<div class="empty-state">
      <div class="empty-icon">🔍</div>
      <div class="empty-title">No Scan Results</div>
      <div class="empty-desc">Run a scan to see security issues.</div>
    </div>\`;
  }

  if (r.issues.length === 0) {
    return \`<div class="empty-state">
      <div class="empty-icon">✅</div>
      <div class="empty-title">No Issues Found!</div>
      <div class="empty-desc">Your codebase looks clean. Keep it up!</div>
    </div>\`;
  }

  const sorted = [...r.issues].sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return (order[a.severity] ?? 5) - (order[b.severity] ?? 5);
  });

  return \`
    <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">
      \${sorted.length} issue\${sorted.length !== 1 ? 's' : ''} found
      · \${state.resolvedIssues.length} resolved
    </div>
    \${sorted.map(issue => renderIssueItem(issue)).join('')}
  \`;
}

function renderIssueItem(issue) {
  const resolved = state.resolvedIssues.includes(issue.ruleId);
  const icon = resolved ? '✅' : severityIcon(issue.severity);
  return \`
    <div class="issue-item \${resolved ? 'resolved' : ''}">
      <div class="issue-header">
        <span class="issue-icon">\${icon}</span>
        <span class="issue-title">\${esc(issue.title)}</span>
        <span class="badge badge-\${issue.severity}">\${issue.severity}</span>
        <span class="issue-chevron">▶</span>
      </div>
      <div class="issue-body">
        <p class="issue-description">\${esc(issue.description)}</p>

        \${issue.attackScenario ? \`
          <div class="attack-box">
            <strong>⚠ Attack Scenario</strong>
            \${esc(issue.attackScenario)}
          </div>
        \` : ''}

        <div class="issue-section-label">Affected Files (\${issue.locations.length})</div>
        \${issue.locations.slice(0, 8).map(loc => \`
          <div class="location-item" onclick="openFile('\${esc(loc.file)}', \${loc.line})">
            <span>📄</span>
            <span class="location-file">\${esc(shortPath(loc.file))}</span>
            <span class="location-line">line \${loc.line}</span>
            \${loc.snippet ? \`<span title="\${esc(loc.snippet)}" style="color:var(--text-muted);">ℹ</span>\` : ''}
          </div>
        \`).join('')}
        \${issue.locations.length > 8 ? \`<div style="font-size:10px;color:var(--text-muted);padding:4px 8px;">+\${issue.locations.length - 8} more locations</div>\` : ''}

        <div class="issue-section-label">Remediation</div>
        <p style="font-size:12px;color:var(--text-muted);">\${esc(issue.remediationGuidance)}</p>

        <div class="issue-actions">
          <button class="btn btn-secondary btn-sm" id="fix-btn-\${issue.ruleId}" onclick="generateFix('\${issue.ruleId}')">
            🤖 Generate Fix Prompt
          </button>
          \${!resolved ? \`<button class="btn btn-ghost btn-sm" onclick="markResolved('\${issue.ruleId}')">
            ✓ Mark Resolved
          </button>\` : \`<span style="font-size:11px;color:var(--success);">✅ Marked resolved — rescan to verify</span>\`}
        </div>
      </div>
    </div>
  \`;
}

function severityIcon(s) {
  return { critical: '🔴', high: '🟠', medium: '🟡', low: '🔵', info: '⚪' }[s] ?? '⚫';
}

// ── Checklist ──────────────────────────────────────────────────────────
function renderChecklist() {
  const r = state.scanResult;
  if (!r) {
    return \`<div class="empty-state">
      <div class="empty-icon">📋</div>
      <div class="empty-title">No Checklist Yet</div>
      <div class="empty-desc">Run a scan to generate your security checklist.</div>
    </div>\`;
  }

  const allRuleIds = r.issues.map(i => i.ruleId);
  const resolved = state.resolvedIssues;

  // Rules that passed (not found in issues)
  const knownRules = [
    { id: 'helmet', label: 'Security Headers (Helmet)' },
    { id: 'rate_limiting', label: 'Rate Limiting' },
    { id: 'cors_policy', label: 'CORS Policy' },
    { id: 'input_validation', label: 'Input Validation' },
    { id: 'env_secrets', label: 'Environment Variables' },
    { id: 'jwt_security', label: 'JWT Configuration' },
    { id: 'cookie_security', label: 'Secure Cookies' },
    { id: 'sql_protection', label: 'SQL Injection Protection' },
    { id: 'xss_protection', label: 'XSS Protection' },
  ];

  const issueIds = new Set(r.issues.map(i => i.ruleId));

  const passed = [
    !issueIds.has('missing_helmet') ? 'Helmet / Security Headers' : null,
    !issueIds.has('missing_rate_limiting') ? 'Rate Limiting' : null,
    !issueIds.has('open_cors') ? 'CORS Policy' : null,
    !issueIds.has('missing_input_validation') ? 'Input Validation' : null,
    !issueIds.has('hardcoded_secrets') && !issueIds.has('exposed_api_key') ? 'Secrets Management' : null,
    !issueIds.has('unsafe_jwt') ? 'JWT Security' : null,
    !issueIds.has('insecure_cookies') ? 'Cookie Security' : null,
    !issueIds.has('sql_injection_risk') ? 'SQL Injection Protection' : null,
    !issueIds.has('xss_risk') ? 'XSS Protection' : null,
  ].filter(Boolean);

  const failed = r.issues.filter(i => !resolved.includes(i.ruleId));
  const resolvedItems = r.issues.filter(i => resolved.includes(i.ruleId));

  return \`
    <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">
      Security Score: <strong style="color:\${scoreColor(r.score.total)}">\${r.score.total}/100</strong>
      — Grade <strong>\${r.score.grade}</strong>
    </div>

    \${passed.length > 0 ? \`
      <div class="section-title">✅ Passing (\${passed.length})</div>
      \${passed.map(label => \`
        <div class="check-item">
          <span class="check-icon" style="color:var(--success);">✓</span>
          <span class="check-label">\${esc(label)}</span>
        </div>
      \`).join('')}
    \` : ''}

    \${failed.length > 0 ? \`
      <div class="section-title">❌ Issues Found (\${failed.length})</div>
      \${failed.map(issue => \`
        <div class="check-item" onclick="setTab('issues')" style="cursor:pointer;">
          <span class="check-icon">❌</span>
          <span class="check-label" style="flex:1;">\${esc(issue.title)}</span>
          <span class="badge badge-\${issue.severity}">\${issue.severity}</span>
        </div>
      \`).join('')}
    \` : ''}

    \${resolvedItems.length > 0 ? \`
      <div class="section-title">🔄 Marked Resolved (\${resolvedItems.length})</div>
      \${resolvedItems.map(issue => \`
        <div class="check-item">
          <span class="check-icon" style="color:var(--text-muted);">○</span>
          <span class="check-label check-resolved">\${esc(issue.title)}</span>
          <span style="font-size:10px;color:var(--text-muted);">pending rescan</span>
        </div>
      \`).join('')}
      <div style="margin-top:8px;">
        <button class="btn btn-secondary btn-sm" onclick="rescan()">🔄 Rescan to Verify</button>
      </div>
    \` : ''}
  \`;
}

// ── Init ──────────────────────────────────────────────────────────────
render();
post('ready');
</script>
</body>
</html>`;
}
