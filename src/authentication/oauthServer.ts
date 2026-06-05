import * as http from 'http';
import * as net from 'net';

export interface OAuthCallbackResult {
  sessionId?: string;
  dbJwt?: string;
  status?: string;
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

export function startOAuthCallbackServer(
  port: number,
  timeoutMs = 180000
): Promise<OAuthCallbackResult> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) return;

      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      const status = url.searchParams.get('__clerk_status');
      const dbJwt = url.searchParams.get('__clerk_db_jwt');
      const sessionId = url.searchParams.get('__clerk_created_session_id');
      const error = url.searchParams.get('error') ?? url.searchParams.get('error_description');

      const successHtml = `<!DOCTYPE html>
<html>
<head><title>SecureScan — Signed In</title>
<style>
  body { margin:0; background:#0d1117; color:#e6edf3;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    display:flex; align-items:center; justify-content:center; height:100vh; }
  .card { text-align:center; padding:40px; }
  .icon { font-size:56px; margin-bottom:16px; }
  h2 { margin:0 0 8px; font-size:22px; }
  p { color:#7d8590; font-size:14px; margin:0; }
  .bar { width:200px; height:3px; background:#238636; border-radius:3px;
    margin:20px auto 0; animation:shrink 2s linear forwards; }
  @keyframes shrink { from{width:200px} to{width:0} }
</style></head>
<body>
  <div class="card">
    <div class="icon">🛡️</div>
    <h2>Signed in successfully!</h2>
    <p>Return to VS Code — this tab will close automatically.</p>
    <div class="bar"></div>
  </div>
  <script>setTimeout(() => window.close(), 2100)</script>
</body>
</html>`;

      const errorHtml = `<!DOCTYPE html>
<html>
<head><title>SecureScan — Error</title>
<style>
  body { margin:0; background:#0d1117; color:#e6edf3;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    display:flex; align-items:center; justify-content:center; height:100vh; }
  .card { text-align:center; padding:40px; }
  .icon { font-size:56px; margin-bottom:16px; }
  h2 { margin:0 0 8px; color:#f85149; }
  p { color:#7d8590; font-size:14px; }
</style></head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h2>Authentication Failed</h2>
    <p>${error ?? 'Unknown error. Please try again.'}</p>
    <p>You can close this tab and return to VS Code.</p>
  </div>
</body>
</html>`;

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(error ? errorHtml : successHtml);

      clearTimeout(timer);
      server.close();

      if (error) {
        resolve({ error });
      } else {
        resolve({
          status: status ?? undefined,
          dbJwt: dbJwt ?? undefined,
          sessionId: sessionId ?? undefined,
        });
      }
    });

    server.listen(port, '127.0.0.1');

    const timer = setTimeout(() => {
      server.close();
      reject(new Error('OAuth timed out — no response after 3 minutes'));
    }, timeoutMs);

    server.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
