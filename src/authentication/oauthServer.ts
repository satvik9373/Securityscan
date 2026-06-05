import * as http from 'http';
import * as net from 'net';

export interface OAuthCallbackResult {
  token?: string;
  userId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  imageUrl?: string;
  error?: string;
}

export async function findAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as net.AddressInfo;
      server.close(() => resolve(addr.port));
    });
    server.on('error', reject);
  });
}

function buildAuthHtml(publishableKey: string, provider: string, port: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>SecureScan — Sign In</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#0d1117;color:#e6edf3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    display:flex;align-items:center;justify-content:center;height:100vh}
  .card{text-align:center;padding:40px 48px;max-width:420px}
  .logo{font-size:48px;margin-bottom:12px}
  h2{font-size:20px;font-weight:700;margin-bottom:6px}
  p{color:#7d8590;font-size:14px;margin-bottom:20px}
  .spinner{width:28px;height:28px;border:3px solid #30363d;border-top-color:#238636;
    border-radius:50%;animation:spin .65s linear infinite;margin:0 auto 14px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .status{font-size:13px;color:#7d8590}
  .err{color:#f85149;font-size:13px;margin-top:10px;padding:10px;
    background:rgba(248,81,73,.08);border-radius:6px;border:1px solid rgba(248,81,73,.2)}
</style>
</head>
<body>
<div class="card">
  <div class="logo">🛡️</div>
  <h2>SecureScan</h2>
  <p>Signing you in with <strong>${provider.charAt(0).toUpperCase() + provider.slice(1)}</strong>...</p>
  <div class="spinner" id="spinner"></div>
  <div class="status" id="status">Loading authentication...</div>
  <div class="err" id="err" style="display:none"></div>
</div>

<script>
const PUBLISHABLE_KEY = ${JSON.stringify(publishableKey)};
const PROVIDER       = ${JSON.stringify(provider)};
const PORT           = ${port};

let notified = false;

function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}
function showError(msg) {
  document.getElementById('spinner').style.display = 'none';
  const el = document.getElementById('err');
  el.textContent = msg;
  el.style.display = 'block';
}
function showSuccess() {
  document.getElementById('spinner').style.display = 'none';
  document.getElementById('status').innerHTML =
    '<span style="color:#3fb950;font-size:20px">✅</span><br/>Signed in! Return to VS Code.';
  setTimeout(() => window.close(), 1800);
}

async function notifyExtension(data) {
  if (notified) return;
  notified = true;
  try {
    await fetch('/done', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    showSuccess();
  } catch(e) {
    showError('Could not communicate with VS Code. Please close this tab and try again.');
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.crossOrigin = 'anonymous';
    s.onload = resolve; s.onerror = () => reject(new Error('Failed to load Clerk JS from CDN'));
    document.head.appendChild(s);
  });
}

async function main() {
  try {
    setStatus('Loading Clerk SDK...');
    await loadScript('https://cdn.jsdelivr.net/npm/@clerk/clerk-js@5/dist/clerk.browser.js');

    setStatus('Initializing...');
    const clerk = new window.Clerk(PUBLISHABLE_KEY);
    await clerk.load();

    // Listen for session changes (handles async OAuth completion)
    clerk.addListener(async ({ session }) => {
      if (session && !notified) {
        setStatus('Getting session token...');
        try {
          const token = await session.getToken();
          const u = clerk.user;
          await notifyExtension({
            token,
            userId: u?.id,
            email: u?.emailAddresses?.[0]?.emailAddress,
            firstName: u?.firstName,
            lastName: u?.lastName,
            imageUrl: u?.imageUrl,
          });
        } catch(e) {
          showError('Session error: ' + e.message);
        }
      }
    });

    // If Clerk already has a session (unlikely but possible)
    if (clerk.session) {
      return; // listener will fire
    }

    // Check if this page load is an OAuth callback from the provider
    const sp = new URLSearchParams(window.location.search);
    const isCallback =
      sp.has('__clerk_status') ||
      sp.has('__clerk_db_jwt') ||
      sp.has('__clerk_created_session_id') ||
      sp.has('code') ||         // Generic OAuth code
      sp.has('state');           // Generic OAuth state

    if (isCallback) {
      setStatus('Completing sign-in...');
      try {
        await clerk.handleRedirectCallback({
          afterSignInUrl: window.location.href,
          afterSignUpUrl: window.location.href,
        });
      } catch(e) {
        // Clerk may handle it automatically; wait for listener
        setStatus('Finalizing...');
      }
      // Give listener time to fire
      await new Promise(r => setTimeout(r, 3000));
      if (!notified) {
        if (clerk.session) {
          // listener missed it
          const token = await clerk.session.getToken();
          const u = clerk.user;
          await notifyExtension({ token, userId: u?.id, email: u?.emailAddresses?.[0]?.emailAddress, firstName: u?.firstName, lastName: u?.lastName, imageUrl: u?.imageUrl });
        } else {
          showError('Sign-in did not complete. Please try again.');
          await notifyExtension({ error: 'OAuth did not complete' });
        }
      }
      return;
    }

    // Fresh load — start OAuth
    setStatus('Redirecting to ' + PROVIDER + '...');
    await clerk.client.signIn.authenticateWithRedirect({
      strategy: 'oauth_' + PROVIDER,
      redirectUrl: 'http://127.0.0.1:' + PORT + '/',
      redirectUrlComplete: 'http://127.0.0.1:' + PORT + '/',
    });

  } catch(e) {
    showError('Authentication failed: ' + (e.message || String(e)));
    await notifyExtension({ error: e.message || String(e) }).catch(() => {});
  }
}

main();
</script>
</body>
</html>`;
}

export function startOAuthCallbackServer(
  port: number,
  publishableKey: string,
  provider: string,
  timeoutMs = 300000   // 5 min — user might be slow with Google 2FA
): Promise<OAuthCallbackResult> {
  return new Promise((resolve, reject) => {
    const html = buildAuthHtml(publishableKey, provider, port);

    const server = http.createServer((req, res) => {
      if (!req.url) { res.writeHead(400); res.end(); return; }

      const url = new URL(req.url, `http://127.0.0.1:${port}`);

      // POST /done — extension receives auth result from browser page
      if (req.method === 'POST' && url.pathname === '/done') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          // CORS headers so the page can POST to us
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end('{"ok":true}');
          clearTimeout(timer);
          server.close();

          try {
            resolve(JSON.parse(body) as OAuthCallbackResult);
          } catch {
            resolve({ error: 'Could not parse auth result' });
          }
        });
        return;
      }

      // OPTIONS preflight (CORS)
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
        return;
      }

      // GET / or any other path — serve the auth HTML page
      // (handles initial load AND OAuth redirect back from provider)
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      res.writeHead(404); res.end();
    });

    server.listen(port, '127.0.0.1');

    const timer = setTimeout(() => {
      server.close();
      reject(new Error('Authentication timed out after 5 minutes'));
    }, timeoutMs);

    server.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
