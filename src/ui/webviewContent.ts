import * as vscode from 'vscode';

export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const fontUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'resources', 'fonts', 'InterTight.ttf')
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src 'unsafe-inline'; script-src 'unsafe-inline';" />
  <title>SecureScan</title>
  <style>
    @font-face {
      font-family: 'InterTight';
      src: url('${fontUri}') format('truetype');
      font-weight: 100 900;
      font-style: normal;
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:        var(--vscode-sideBar-background, #0a0a0a);
      --bg-card:   var(--vscode-editor-background, #111111);
      --bg-hover:  rgba(255,255,255,0.04);
      --border:    var(--vscode-panel-border, #1e1e1e);
      --border-hi: rgba(255,255,255,0.10);
      --text:      var(--vscode-foreground, #f0f0f0);
      --muted:     var(--vscode-descriptionForeground, #666666);
      --muted-hi:  #888888;
      --accent:    #2563eb;
      --accent-hi: #3b82f6;
      --critical:  #ef4444;
      --high:      #f97316;
      --medium:    #eab308;
      --low:       #3b82f6;
      --success:   #22c55e;
      --r:         6px;
      --rs:        4px;
    }

    html, body {
      background: var(--bg);
      color: var(--text);
      font-family: 'InterTight', var(--vscode-font-family, -apple-system, sans-serif);
      font-size: 12px;
      line-height: 1.5;
      letter-spacing: -0.01em;
      font-weight: 500;
      height: 100%;
      overflow-x: hidden;
    }

    #app { padding: 14px 12px; min-height: 100vh; }

    /* ── Typography ── */
    .label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
    }
    .heading {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text);
    }
    .mono {
      font-family: var(--vscode-editor-font-family, 'SF Mono', 'Consolas', monospace);
      font-size: 10.5px;
      letter-spacing: -0.01em;
    }

    /* ── Buttons ── */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 7px 12px;
      border: none;
      border-radius: var(--rs);
      font-family: inherit;
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: -0.01em;
      cursor: pointer;
      transition: background 0.12s, opacity 0.12s;
      white-space: nowrap;
    }
    .btn-primary {
      background: var(--accent);
      color: #fff;
      width: 100%;
      justify-content: center;
    }
    .btn-primary:hover { background: var(--accent-hi); }
    .btn-secondary {
      background: transparent;
      color: var(--text);
      border: 1px solid var(--border-hi);
      width: 100%;
      justify-content: center;
    }
    .btn-secondary:hover { background: var(--bg-hover); }
    .btn-ghost {
      background: transparent;
      color: var(--muted);
      border: none;
      padding: 4px 8px;
      font-size: 11px;
    }
    .btn-ghost:hover { color: var(--text); }
    .btn-sm { padding: 4px 10px; font-size: 11px; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }

    /* ── Cards ── */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--r);
      padding: 14px;
      margin-bottom: 8px;
    }
    .card-hdr {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    /* ── Score Ring ── */
    .score-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 10px 0 14px;
    }
    .score-ring { position: relative; width: 96px; height: 96px; }
    .score-ring svg { transform: rotate(-90deg); }
    .score-ring circle { fill: none; stroke-width: 7; stroke-linecap: round; }
    .track { stroke: var(--border-hi); }
    .fill { transition: stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1); }
    .score-inner {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .score-num {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.04em;
      line-height: 1;
    }
    .score-denom {
      font-size: 10px;
      color: var(--muted);
      letter-spacing: 0;
      margin-top: 1px;
    }
    .grade-badge {
      margin-top: 10px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      padding: 3px 12px;
      border-radius: 20px;
    }

    /* ── Stats row ── */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 5px;
      margin-top: 10px;
    }
    .stat {
      text-align: center;
      padding: 8px 4px;
      border-radius: var(--rs);
      background: rgba(255,255,255,0.02);
      border: 1px solid var(--border);
    }
    .stat-v {
      font-size: 17px;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1;
    }
    .stat-k {
      font-size: 9px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
      margin-top: 3px;
    }
    .c .stat-v { color: var(--critical); }
    .h .stat-v { color: var(--high); }
    .m .stat-v { color: var(--medium); }
    .l .stat-v { color: var(--low); }

    /* ── Severity badge ── */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      flex-shrink: 0;
    }
    .badge-critical { background: rgba(239,68,68,0.12); color: var(--critical); }
    .badge-high     { background: rgba(249,115,22,0.12); color: var(--high); }
    .badge-medium   { background: rgba(234,179,8,0.12);  color: var(--medium); }
    .badge-low      { background: rgba(59,130,246,0.12); color: var(--low); }
    .badge-info     { background: rgba(255,255,255,0.06); color: var(--muted); }

    /* ── Issues ── */
    .issue-item {
      border: 1px solid var(--border);
      border-radius: var(--rs);
      margin-bottom: 4px;
      overflow: hidden;
      transition: border-color 0.12s;
    }
    .issue-item.resolved { opacity: 0.4; }
    .issue-item:hover { border-color: var(--border-hi); }
    .issue-hdr {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 11px;
      cursor: pointer;
      user-select: none;
    }
    .sev-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .dot-critical { background: var(--critical); }
    .dot-high     { background: var(--high); }
    .dot-medium   { background: var(--medium); }
    .dot-low      { background: var(--low); }
    .dot-info     { background: var(--muted); }
    .issue-title {
      flex: 1;
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--text);
    }
    .issue-chev {
      color: var(--muted);
      font-size: 9px;
      transition: transform 0.15s;
      flex-shrink: 0;
    }
    .issue-item.open .issue-chev { transform: rotate(90deg); }
    .issue-body {
      display: none;
      padding: 12px 11px;
      border-top: 1px solid var(--border);
    }
    .issue-item.open .issue-body { display: block; }
    .issue-desc {
      font-size: 11.5px;
      color: var(--muted-hi);
      line-height: 1.6;
      margin-bottom: 12px;
    }

    /* ── Section label ── */
    .sec-lbl {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--muted);
      margin: 10px 0 5px;
    }

    /* ── File locations ── */
    .loc-list { display: flex; flex-direction: column; gap: 2px; }
    .loc {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 8px;
      background: rgba(255,255,255,0.02);
      border: 1px solid var(--border);
      border-radius: var(--rs);
      cursor: pointer;
      transition: background 0.1s, border-color 0.1s;
    }
    .loc:hover {
      background: rgba(37,99,235,0.08);
      border-color: rgba(37,99,235,0.3);
    }
    .loc:hover .loc-arrow { opacity: 1; }
    .loc-file {
      flex: 1;
      color: var(--accent-hi);
      font-size: 10.5px;
      font-family: var(--vscode-editor-font-family, 'SF Mono', 'Consolas', monospace);
      letter-spacing: -0.01em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      text-decoration: underline;
      text-underline-offset: 2px;
      text-decoration-color: rgba(59,130,246,0.4);
    }
    .loc-line {
      font-size: 10px;
      color: var(--muted);
      font-family: var(--vscode-editor-font-family, 'SF Mono', 'Consolas', monospace);
      flex-shrink: 0;
      white-space: nowrap;
    }
    .loc-arrow {
      font-size: 10px;
      color: var(--accent-hi);
      opacity: 0;
      transition: opacity 0.1s;
      flex-shrink: 0;
    }

    /* ── Snippet ── */
    .snippet-box {
      background: rgba(0,0,0,0.4);
      border: 1px solid var(--border);
      border-radius: var(--rs);
      padding: 7px 9px;
      font-size: 10px;
      font-family: var(--vscode-editor-font-family, 'SF Mono', 'Consolas', monospace);
      color: var(--muted-hi);
      white-space: pre-wrap;
      word-break: break-all;
      margin-top: 4px;
      letter-spacing: 0;
    }

    /* ── Attack scenario ── */
    .attack-box {
      background: rgba(239,68,68,0.04);
      border: 1px solid rgba(239,68,68,0.12);
      border-radius: var(--rs);
      padding: 9px 10px;
      font-size: 11px;
      color: var(--muted-hi);
      line-height: 1.6;
      margin-top: 8px;
    }
    .attack-label {
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--critical);
      margin-bottom: 4px;
    }

    /* ── Issue actions ── */
    .issue-actions {
      display: flex;
      gap: 6px;
      margin-top: 10px;
      flex-wrap: wrap;
      align-items: center;
    }
    .resolved-tag {
      font-size: 10.5px;
      font-weight: 600;
      color: var(--success);
      letter-spacing: -0.01em;
    }

    /* ── Modal ── */
    .modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      z-index: 100;
      align-items: flex-start;
      justify-content: center;
      padding: 20px;
    }
    .modal-overlay.open { display: flex; }
    .modal {
      background: var(--bg-card);
      border: 1px solid var(--border-hi);
      border-radius: var(--r);
      width: 100%;
      max-height: 84vh;
      overflow-y: auto;
    }
    .modal-hdr {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 13px 14px;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      background: var(--bg-card);
    }
    .modal-title {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .modal-body { padding: 14px; }
    .prompt-box {
      background: rgba(0,0,0,0.35);
      border: 1px solid var(--border);
      border-radius: var(--rs);
      padding: 10px;
      font-size: 10.5px;
      font-family: var(--vscode-editor-font-family, 'SF Mono', 'Consolas', monospace);
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--text);
      max-height: 260px;
      overflow-y: auto;
      margin: 6px 0;
      letter-spacing: 0;
      line-height: 1.6;
    }

    /* ── Progress ── */
    .progress-card { padding: 12px 14px; }
    .progress-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--text);
      letter-spacing: -0.01em;
      margin-bottom: 8px;
    }
    .progress-track {
      height: 3px;
      background: var(--border);
      border-radius: 2px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      border-radius: 2px;
      background: var(--accent);
      transition: width 0.3s ease;
    }
    .progress-pct {
      text-align: right;
      font-size: 10px;
      color: var(--muted);
      margin-top: 4px;
    }

    /* ── Tabs ── */
    .tabs {
      display: flex;
      gap: 2px;
      margin-bottom: 10px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 0;
    }
    .tab {
      padding: 7px 12px;
      font-size: 11.5px;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--muted);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
      transition: color 0.12s;
    }
    .tab.active {
      color: var(--text);
      border-bottom-color: var(--accent);
    }
    .tab:hover:not(.active) { color: var(--muted-hi); }

    /* ── Section divider ── */
    .section-hdr {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--muted);
      margin: 12px 0 7px;
      padding-bottom: 5px;
      border-bottom: 1px solid var(--border);
    }

    /* ── Empty state ── */
    .empty {
      text-align: center;
      padding: 32px 16px;
      color: var(--muted);
    }
    .empty-heading {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text);
      margin-bottom: 5px;
    }
    .empty-sub { font-size: 11.5px; color: var(--muted); }

    /* ── Toast ── */
    .toast {
      position: fixed;
      bottom: 14px;
      left: 50%;
      transform: translateX(-50%);
      background: #1a1a1a;
      border: 1px solid var(--border-hi);
      padding: 7px 14px;
      border-radius: var(--rs);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: -0.01em;
      z-index: 200;
      transition: opacity 0.25s;
      pointer-events: none;
      white-space: nowrap;
    }

    /* ── Header ── */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }
    .header-left { display: flex; align-items: center; gap: 8px; }
    .app-name {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: -0.03em;
      color: var(--text);
    }
    .app-version {
      font-size: 9px;
      font-weight: 700;
      padding: 2px 5px;
      border-radius: 3px;
      background: rgba(37,99,235,0.15);
      color: var(--accent-hi);
      border: 1px solid rgba(37,99,235,0.25);
      letter-spacing: 0.03em;
    }

    /* ── Framework tag ── */
    .fw-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 3px;
      background: rgba(255,255,255,0.05);
      color: var(--muted-hi);
      border: 1px solid var(--border-hi);
      letter-spacing: 0;
    }

    /* ── Scan meta ── */
    .scan-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      font-size: 10.5px;
      color: var(--muted);
      margin-top: 8px;
      letter-spacing: -0.01em;
    }
    .scan-meta-item { display: flex; align-items: center; gap: 3px; }

    /* ── Checklist ── */
    .check-item {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 7px 0;
      font-size: 11.5px;
      font-weight: 500;
      border-bottom: 1px solid rgba(255,255,255,0.03);
      cursor: pointer;
      letter-spacing: -0.01em;
    }
    .check-item:last-child { border-bottom: none; }
    .check-status {
      width: 14px;
      height: 14px;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 9px;
      font-weight: 800;
    }
    .status-pass {
      background: rgba(34,197,94,0.12);
      border: 1px solid rgba(34,197,94,0.25);
      color: var(--success);
    }
    .status-fail {
      background: rgba(239,68,68,0.10);
      border: 1px solid rgba(239,68,68,0.2);
      color: var(--critical);
    }
    .status-resolved {
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--border);
      color: var(--muted);
    }
    .check-label { flex: 1; }
    .check-resolved-text { text-decoration: line-through; color: var(--muted); }

    /* ── Spinner ── */
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner {
      display: inline-block;
      width: 13px;
      height: 13px;
      border: 2px solid var(--border-hi);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.55s linear infinite;
    }

    /* ── Error banner ── */
    .error-banner {
      background: rgba(239,68,68,0.06);
      border: 1px solid rgba(239,68,68,0.2);
      border-radius: var(--rs);
      padding: 9px 11px;
      font-size: 11px;
      color: var(--critical);
      letter-spacing: -0.01em;
      margin-bottom: 8px;
    }

    /* ── Count pills ── */
    .pill {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 3px;
      background: rgba(255,255,255,0.07);
      color: var(--muted-hi);
      letter-spacing: 0;
    }
  </style>
</head>
<body>
<div id="app">
  <div class="header">
    <div class="header-left">
      <span class="app-name">SecureScan</span>
      <span class="app-version">BETA</span>
    </div>
    <div id="headerRight"></div>
  </div>
  <div id="root"></div>
</div>

<!-- Fix Modal -->
<div class="modal-overlay" id="fixModal">
  <div class="modal">
    <div class="modal-hdr">
      <span class="modal-title" id="fixModalTitle">AI Fix Prompt</span>
      <button class="btn btn-ghost" onclick="closeFixModal()">close</button>
    </div>
    <div class="modal-body" id="fixModalBody"></div>
  </div>
</div>

<div class="toast" id="toast" style="opacity:0"></div>

<script>
const vscode = acquireVsCodeApi();

let S = {
  scan: null,
  resolved: [],
  scanning: false,
  progress: { message: '', percent: 0 },
  tab: 'dashboard',
  error: null,
};

function set(patch) { S = { ...S, ...patch }; render(); }

window.addEventListener('message', ev => {
  const msg = ev.data;
  switch (msg.type) {
    case 'updateState':
      set({
        ...(msg.payload.scanResult     !== undefined && { scan: msg.payload.scanResult }),
        ...(msg.payload.resolvedIssues !== undefined && { resolved: msg.payload.resolvedIssues }),
        scanning: false, error: null,
      });
      if (msg.payload.fixPrompt) openFixModal(msg.payload.fixPrompt);
      break;
    case 'scanProgress':
      set({ scanning: true, progress: msg.payload });
      break;
    case 'scanComplete':
      set({ scanning: false, scan: msg.payload, error: null });
      break;
    case 'error':
      set({ scanning: false, error: msg.payload });
      break;
  }
});

function post(type, payload) { vscode.postMessage({ type, payload }); }
function scan()   { set({ scanning: true, error: null }); post('scan'); }
function rescan() { set({ scanning: true, error: null }); post('rescan'); }
function openFile(file, line) { post('openFile', { file, line }); }
function markResolved(id) { post('markResolved', { ruleId: id }); }
function generateFix(id)  { post('generateFix', { ruleId: id }); }
function setTab(t) { set({ tab: t }); }

// ── Fix Modal ──────────────────────────────────────────────────────────────────
function openFixModal(fix) {
  document.getElementById('fixModalTitle').textContent = fix.issueId ?? 'AI Fix Prompt';
  document.getElementById('fixModalBody').innerHTML =
    '<div class="sec-lbl">Explanation</div>' +
    '<p style="font-size:11.5px;color:var(--muted-hi);margin:6px 0 12px;line-height:1.6;">' + esc(fix.explanation) + '</p>' +
    '<div class="sec-lbl">Remediation Plan</div>' +
    '<p style="font-size:11.5px;color:var(--muted-hi);margin:6px 0 12px;line-height:1.6;">' + esc(fix.remediationPlan) + '</p>' +
    '<div class="sec-lbl">Copy-Ready Prompt</div>' +
    '<div class="prompt-box" id="promptBox">' + esc(fix.copyablePrompt) + '</div>' +
    '<button class="btn btn-primary" style="margin-top:10px;" onclick="copyPrompt()">Copy Prompt</button>';
  document.getElementById('fixModal').classList.add('open');
}
function closeFixModal() { document.getElementById('fixModal').classList.remove('open'); }
function copyPrompt() {
  const box = document.getElementById('promptBox');
  if (box) { navigator.clipboard.writeText(box.textContent ?? ''); showToast('Copied to clipboard'); }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.opacity = '1';
  setTimeout(() => { t.style.opacity = '0'; }, 2200);
}
function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function shortPath(p) {
  if (!p) return '';
  const norm = p.replace(/\\\\/g, '/');
  const parts = norm.split('/');
  if (parts.length <= 3) return norm;
  return parts.slice(-3).join('/');
}
function scoreColor(n) {
  return n >= 80 ? 'var(--success)' : n >= 60 ? 'var(--medium)' : n >= 40 ? 'var(--high)' : 'var(--critical)';
}
function sevDot(s) {
  return '<span class="sev-dot dot-' + (s||'info') + '"></span>';
}
function sevBadge(s) {
  return '<span class="badge badge-' + (s||'info') + '">' + (s||'info') + '</span>';
}

// ── RENDER ─────────────────────────────────────────────────────────────────────
function render() {
  const root = document.getElementById('root');
  if (!root) return;

  root.innerHTML = renderTabs() + renderTabContent();

  // Attach issue toggle listeners
  document.querySelectorAll('.issue-hdr').forEach(el => {
    el.addEventListener('click', () => el.closest('.issue-item').classList.toggle('open'));
  });
}

// ── Tabs ───────────────────────────────────────────────────────────────────────
function renderTabs() {
  const n = S.scan ? S.scan.issues.length : null;
  const pill = n !== null ? '<span class="pill" style="margin-left:4px;">' + n + '</span>' : '';
  return \`<div class="tabs">
    <div class="tab \${S.tab==='dashboard'?'active':''}" onclick="setTab('dashboard')">Dashboard</div>
    <div class="tab \${S.tab==='issues'?'active':''}" onclick="setTab('issues')">Issues\${pill}</div>
    <div class="tab \${S.tab==='checklist'?'active':''}" onclick="setTab('checklist')">Checklist</div>
  </div>\`;
}

function renderTabContent() {
  switch (S.tab) {
    case 'dashboard':  return renderDashboard();
    case 'issues':     return renderIssues();
    case 'checklist':  return renderChecklist();
    default: return '';
  }
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
function renderDashboard() {
  const r = S.scan;
  return (
    (S.error ? '<div class="error-banner">' + esc(S.error) + '</div>' : '') +
    (S.scanning ? renderProgress() : '') +
    (r ? renderScoreCard() : '') +
    (!r && !S.scanning ? renderEmptyState() : '') +
    renderActions()
  );
}

function renderEmptyState() {
  return \`<div class="empty">
    <div class="empty-heading">Ready to Scan</div>
    <div class="empty-sub">Analyze your codebase for security vulnerabilities</div>
  </div>\`;
}

function renderActions() {
  const r = S.scan;
  const dis = S.scanning ? 'disabled' : '';
  if (!r) {
    return \`<div style="margin-top:6px;"><button class="btn btn-primary" onclick="scan()" \${dis}>Scan Project</button></div>\`;
  }
  return \`<div style="display:flex;gap:6px;margin-top:6px;">
    <button class="btn btn-primary" onclick="rescan()" \${dis} style="flex:1;">Rescan</button>
    <button class="btn btn-secondary" onclick="scan()" \${dis} style="flex:1;">Full Scan</button>
  </div>\`;
}

function renderProgress() {
  const p = S.progress;
  return \`<div class="card progress-card" style="margin-bottom:8px;">
    <div class="progress-label">
      <span class="spinner" style="vertical-align:middle;margin-right:7px;"></span>
      \${esc(p.message || 'Scanning...')}
    </div>
    <div class="progress-track">
      <div class="progress-fill" style="width:\${p.percent ?? 0}%"></div>
    </div>
    <div class="progress-pct">\${p.percent ?? 0}%</div>
  </div>\`;
}

function renderScoreCard() {
  const r = S.scan;
  const s = r.score;
  const color = scoreColor(s.total);
  const C = 2 * Math.PI * 42;
  const offset = C * (1 - s.total / 100);
  return \`<div class="card">
    <div class="card-hdr">
      <span class="label">Security Score</span>
      <span class="fw-tag">\${r.framework}</span>
    </div>
    <div class="score-wrap">
      <div class="score-ring">
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle class="track" cx="48" cy="48" r="42"/>
          <circle class="fill" cx="48" cy="48" r="42"
            stroke="\${color}" stroke-dasharray="\${C.toFixed(1)}" stroke-dashoffset="\${offset.toFixed(1)}"/>
        </svg>
        <div class="score-inner">
          <span class="score-num" style="color:\${color}">\${s.total}</span>
          <span class="score-denom">/ 100</span>
        </div>
      </div>
      <div class="grade-badge" style="background:\${color}18;color:\${color};border:1px solid \${color}30;">
        Grade \${s.grade}
      </div>
    </div>
    <div class="stats-row">
      <div class="stat c"><div class="stat-v">\${s.breakdown.critical}</div><div class="stat-k">Critical</div></div>
      <div class="stat h"><div class="stat-v">\${s.breakdown.high}</div><div class="stat-k">High</div></div>
      <div class="stat m"><div class="stat-v">\${s.breakdown.medium}</div><div class="stat-k">Medium</div></div>
      <div class="stat l"><div class="stat-v">\${s.breakdown.low}</div><div class="stat-k">Low</div></div>
    </div>
    <div class="scan-meta">
      <span class="scan-meta-item">\${new Date(r.timestamp).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
      <span class="scan-meta-item">\${r.fileCount} files</span>
      <span class="scan-meta-item">\${r.linesScanned.toLocaleString()} lines</span>
      <span class="scan-meta-item">\${(r.duration/1000).toFixed(1)}s</span>
    </div>
  </div>\`;
}

// ── Issues ─────────────────────────────────────────────────────────────────────
function renderIssues() {
  const r = S.scan;
  if (!r) return \`<div class="empty">
    <div class="empty-heading">No Scan Results</div>
    <div class="empty-sub">Run a scan to detect security issues</div>
  </div>\`;

  if (!r.issues.length) return \`<div class="empty">
    <div class="empty-heading">No Issues Found</div>
    <div class="empty-sub">Your codebase passed all security checks</div>
  </div>\`;

  const ORDER = { critical:0, high:1, medium:2, low:3, info:4 };
  const sorted = [...r.issues].sort((a,b) => (ORDER[a.severity]??5)-(ORDER[b.severity]??5));

  return \`<div style="font-size:10.5px;color:var(--muted);margin-bottom:8px;letter-spacing:-0.01em;">
    \${sorted.length} \${sorted.length===1?'issue':'issues'} &middot; \${S.resolved.length} resolved
  </div>
  \${sorted.map(issue => renderIssue(issue)).join('')}\`;
}

function renderIssue(issue) {
  const res = S.resolved.includes(issue.ruleId);
  const locs = (issue.locations || []).slice(0, 12);

  return \`<div class="issue-item \${res?'resolved':''}">
    <div class="issue-hdr">
      \${sevDot(issue.severity)}
      <span class="issue-title">\${esc(issue.title)}</span>
      \${sevBadge(issue.severity)}
      <span class="issue-chev">&#9654;</span>
    </div>
    <div class="issue-body">
      <p class="issue-desc">\${esc(issue.description)}</p>

      \${issue.attackScenario ? \`
        <div class="attack-box">
          <div class="attack-label">Attack Scenario</div>
          \${esc(issue.attackScenario)}
        </div>
      \` : ''}

      <div class="sec-lbl">Affected Files (\${issue.locations.length})</div>
      <div class="loc-list">
        \${locs.map(loc => renderLoc(loc, issue)).join('')}
        \${issue.locations.length > 12 ? \`<div style="font-size:10px;color:var(--muted);padding:4px 0;">+\${issue.locations.length - 12} more locations</div>\` : ''}
      </div>

      <div class="sec-lbl">Remediation</div>
      <p style="font-size:11.5px;color:var(--muted-hi);line-height:1.6;">\${esc(issue.remediationGuidance)}</p>

      <div class="issue-actions">
        <button class="btn btn-secondary btn-sm" onclick="generateFix('\${esc(issue.ruleId)}')">AI Fix Prompt</button>
        \${res
          ? '<span class="resolved-tag">Marked resolved &mdash; rescan to verify</span>'
          : \`<button class="btn btn-ghost btn-sm" onclick="markResolved('\${esc(issue.ruleId)}')">Mark Resolved</button>\`}
      </div>
    </div>
  </div>\`;
}

function renderLoc(loc, issue) {
  const file = loc.file || '';
  const line = loc.line || 1;
  const display = shortPath(file);
  const hasSnippet = loc.snippet && loc.snippet.length > 0;

  return \`<div>
    <div class="loc" onclick="openFile(\${JSON.stringify(file)}, \${line})">
      <span class="loc-file" title="\${esc(file)}">\${esc(display)}</span>
      <span class="loc-line">line \${line}</span>
      <span class="loc-arrow">&#8594;</span>
    </div>
    \${hasSnippet ? '<div class="snippet-box">' + esc(loc.snippet.substring(0, 200)) + '</div>' : ''}
  </div>\`;
}

// ── Checklist ──────────────────────────────────────────────────────────────────
function renderChecklist() {
  const r = S.scan;
  if (!r) return \`<div class="empty">
    <div class="empty-heading">No Checklist</div>
    <div class="empty-sub">Run a scan first to generate a security checklist</div>
  </div>\`;

  const issueIds = new Set(r.issues.map(i => i.ruleId));
  const color = scoreColor(r.score.total);

  const ALL_CHECKS = [
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
    ['missing_env_validation',   'Env Variable Validation'],
  ];

  const passing  = ALL_CHECKS.filter(([id]) => !issueIds.has(id));
  const failing  = r.issues.filter(i => !S.resolved.includes(i.ruleId));
  const resolved = r.issues.filter(i => S.resolved.includes(i.ruleId));

  return \`<div style="font-size:11.5px;color:var(--muted);margin-bottom:12px;letter-spacing:-0.01em;">
    Score <strong style="color:\${color};font-weight:700;">\${r.score.total}</strong>/100 &mdash; Grade <strong style="color:\${color};">\${r.score.grade}</strong>
  </div>

  \${failing.length ? \`
    <div class="section-hdr">Issues (\${failing.length})</div>
    \${failing.map(i => \`
      <div class="check-item" onclick="setTab('issues')">
        <div class="check-status status-fail">&#10005;</div>
        <span class="check-label">\${esc(i.title)}</span>
        \${sevBadge(i.severity)}
      </div>
    \`).join('')}
  \` : ''}

  \${passing.length ? \`
    <div class="section-hdr">Passing (\${passing.length})</div>
    \${passing.map(([,label]) => \`
      <div class="check-item" style="cursor:default;">
        <div class="check-status status-pass">&#10003;</div>
        <span class="check-label">\${esc(label)}</span>
      </div>
    \`).join('')}
  \` : ''}

  \${resolved.length ? \`
    <div class="section-hdr">Marked Resolved (\${resolved.length})</div>
    \${resolved.map(i => \`
      <div class="check-item" style="cursor:default;">
        <div class="check-status status-resolved">&#9900;</div>
        <span class="check-resolved-text">\${esc(i.title)}</span>
      </div>
    \`).join('')}
    <div style="margin-top:10px;">
      <button class="btn btn-secondary btn-sm" onclick="rescan()">Rescan to Verify</button>
    </div>
  \` : ''}
  \`;
}

// ── Init ───────────────────────────────────────────────────────────────────────
render();
post('ready');
</script>
</body>
</html>`;
}
