import * as http from 'http';
import * as net from 'net';

export interface OAuthCallbackResult {
  sessionId?: string;
  dbJwt?: string;
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

const SUCCESS_HTML = `<!DOCTYPE html><html>
<head><meta charset="UTF-8"><title>SecureScan &#x2014; Signed In</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d1117;color:#e6edf3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}
.icon{font-size:56px;margin-bottom:16px}
h2{font-size:20px;font-weight:700;margin-bottom:8px}
p{color:#7d8590;font-size:14px}
.bar{width:200px;height:3px;background:#238636;border-radius:3px;margin:20px auto 0;
  animation:shrink 2s linear forwards}
@keyframes shrink{from{width:200px}to{width:0}}
</style></head>
<body><div>
  <div class="icon">&#x1F6E1;&#xFE0F;</div>
  <h2>Signed in to SecureScan!</h2>
  <p>Return to VS Code &mdash; this tab will close automatically.</p>
  <div class="bar"></div>
</div>
<script>setTimeout(function(){window.close()},2200)</script>
</body></html>`;

const WAITING_HTML = `<!DOCTYPE html><html>
<head><meta charset="UTF-8"><title>SecureScan &#x2014; Sign In</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d1117;color:#e6edf3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}
.spinner{width:32px;height:32px;border:3px solid #30363d;border-top-color:#238636;
  border-radius:50%;animation:spin .65s linear infinite;margin:0 auto 16px}
@keyframes spin{to{transform:rotate(360deg)}}
p{color:#7d8590;font-size:14px}
</style></head>
<body><div>
  <div class="spinner"></div>
  <p>Completing sign-in, please wait...</p>
</div></body></html>`;

function errorHtml(msg: string): string {
  return `<!DOCTYPE html><html>
<head><meta charset="UTF-8"><title>SecureScan &#x2014; Error</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0d1117;color:#e6edf3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:20px}
.icon{font-size:48px;margin-bottom:12px}
h2{color:#f85149;font-size:18px;margin-bottom:8px}
p{color:#7d8590;font-size:13px}
</style></head>
<body><div>
  <div class="icon">&#x274C;</div>
  <h2>Authentication Failed</h2>
  <p>${msg.replace(/</g,'&lt;')}</p>
  <p style="margin-top:10px">Close this tab and try again in VS Code.</p>
</div></body></html>`;
}

export function startOAuthCallbackServer(
  port: number,
  timeoutMs = 300000
): Promise<OAuthCallbackResult> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) { res.writeHead(400); res.end(); return; }

      const url = new URL(req.url, `http://127.0.0.1:${port}`);

      if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }

      // Extract whatever Clerk puts in the redirect URL
      const status    = url.searchParams.get('__clerk_status');
      const dbJwt     = url.searchParams.get('__clerk_db_jwt');
      const sessionId = url.searchParams.get('__clerk_created_session_id');
      const error     = url.searchParams.get('error') ?? url.searchParams.get('error_description');

      // Clerk sometimes puts params in the hash — we serve a small page that
      // re-sends them as query params so the server can read them
      const hasParams = dbJwt || sessionId || status === 'verified' || error;

      if (!hasParams) {
        // No params yet — serve waiting page or hash-reading page
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<script>
// If Clerk put params in the hash, move them to query string and reload
var hash = window.location.hash.replace(/^#\\/?\\?/,'');
if(hash && hash.includes('__clerk')){
  window.location.href = window.location.pathname + '?' + hash;
}
</script></head><body>${WAITING_HTML}</body></html>`);
        return;
      }

      if (error || status === 'failed') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(errorHtml(error ?? 'Authentication failed'));
        clearTimeout(timer);
        server.close();
        resolve({ error: error ?? 'Authentication failed' });
        return;
      }

      // Success
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(SUCCESS_HTML);
      clearTimeout(timer);
      server.close();
      resolve({
        dbJwt:     dbJwt     ?? undefined,
        sessionId: sessionId ?? undefined,
      });
    });

    server.listen(port, '127.0.0.1');

    const timer = setTimeout(() => {
      server.close();
      reject(new Error('Authentication timed out after 5 minutes'));
    }, timeoutMs);

    server.on('error', err => { clearTimeout(timer); reject(err); });
  });
}
