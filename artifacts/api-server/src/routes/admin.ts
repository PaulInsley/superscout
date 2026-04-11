/**
 * Superscout Admin Dashboard
 * 
 * Drop this into: artifacts/api-server/src/routes/admin.ts
 * Then register in app.ts:  import adminRouter from './routes/admin';
 *                            app.use('/admin', adminRouter);
 * 
 * Set ADMIN_PASSWORD in Replit Secrets (or .env).
 */

import { Router, Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

// ---------------------------------------------------------------------------
// Supabase client (uses existing env vars from your api-server)
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Simple password auth via cookie
// ---------------------------------------------------------------------------
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'superscout-admin-2026';
const COOKIE_NAME = 'ss_admin_auth';
const COOKIE_VALUE = Buffer.from(ADMIN_PASSWORD).toString('base64');

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
}

function isLockedOut(ip: string): { locked: boolean; remainingMs: number } {
  const record = loginAttempts.get(ip);
  if (!record) return { locked: false, remainingMs: 0 };
  if (record.lockedUntil > Date.now()) {
    return { locked: true, remainingMs: record.lockedUntil - Date.now() };
  }
  if (record.lockedUntil > 0 && record.lockedUntil <= Date.now()) {
    loginAttempts.delete(ip);
  }
  return { locked: false, remainingMs: 0 };
}

function recordFailedAttempt(ip: string): void {
  const record = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  loginAttempts.set(ip, record);
}

function clearAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

function isAuthenticated(req: Request): boolean {
  return req.cookies?.[COOKIE_NAME] === COOKIE_VALUE;
}

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Allow login page and login POST through
  if (req.path === '/login' || req.path === '/api/login') {
    return next();
  }
  if (isAuthenticated(req)) {
    return next();
  }
  res.redirect('/api/admin/login');
}

router.use(requireAuth);

// ---------------------------------------------------------------------------
// Login page
// ---------------------------------------------------------------------------
router.get('/login', (_req: Request, res: Response) => {
  res.send(loginPage());
});

router.post('/api/login', (req: Request, res: Response) => {
  const ip = getClientIp(req);
  const lockout = isLockedOut(ip);
  if (lockout.locked) {
    const mins = Math.ceil(lockout.remainingMs / 60000);
    res.status(429).json({ error: 'Too many attempts. Try again in ' + mins + ' minute' + (mins === 1 ? '' : 's') + '.' });
    return;
  }

  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    clearAttempts(ip);
    res.cookie(COOKIE_NAME, COOKIE_VALUE, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });
    res.json({ success: true });
  } else {
    recordFailedAttempt(ip);
    const record = loginAttempts.get(ip);
    const remaining = MAX_ATTEMPTS - (record?.count || 0);
    if (remaining <= 0) {
      res.status(429).json({ error: 'Too many attempts. Locked out for 15 minutes.' });
    } else {
      res.status(401).json({ error: 'Invalid password. ' + remaining + ' attempt' + (remaining === 1 ? '' : 's') + ' remaining.' });
    }
  }
});

router.post('/api/logout', (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Dashboard page
// ---------------------------------------------------------------------------
router.get('/', (_req: Request, res: Response) => {
  res.send(dashboardPage());
});

// ---------------------------------------------------------------------------
// API: Table list with row counts
// ---------------------------------------------------------------------------
router.get('/api/tables', async (_req: Request, res: Response) => {
  try {
    const resp = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    });
    const spec = await resp.json();
    const tables = Object.keys(spec.definitions || {});

    const results = [];
    for (const table of tables.sort()) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      results.push({
        name: table,
        count: error ? -1 : count,
        error: error?.message,
      });
    }
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API: Query a table
// ---------------------------------------------------------------------------
router.post('/api/query', async (req: Request, res: Response) => {
  try {
    const { table, select = '*', filters = [], order_by, ascending = false, limit = 20 } = req.body;

    if (!table) {
      res.status(400).json({ error: 'table is required' });
      return;
    }

    const safeLimit = Math.min(limit, 500);
    let query = supabase.from(table).select(select, { count: 'exact' });

    for (const f of filters) {
      if (f.operator === 'in') {
        query = query.in(f.column, Array.isArray(f.value) ? f.value : [f.value]);
      } else if (f.operator === 'is') {
        query = query.is(f.column, f.value);
      } else {
        query = (query as any)[f.operator](f.column, f.value);
      }
    }

    if (order_by) {
      query = query.order(order_by, { ascending });
    }

    query = query.limit(safeLimit);

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({ total: count, returned: data?.length || 0, rows: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// API: Recent rows from a table
// ---------------------------------------------------------------------------
router.get('/api/recent/:table', async (req: Request, res: Response) => {
  try {
    const { table } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

    // Try ordering by created_at, fall back to id
    let { data, error } = await supabase
      .from(table)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      // Retry without created_at ordering
      const retry = await supabase.from(table).select('*').limit(limit);
      data = retry.data;
      error = retry.error;
    }

    if (error) throw error;
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// HTML Templates
// ---------------------------------------------------------------------------
function loginPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Superscout Admin — Login</title>
  <style>${sharedStyles()}
    .login-box { max-width: 360px; margin: 120px auto; padding: 32px; background: #1a1a2e; border-radius: 16px; border: 1px solid #2a2a4a; }
    .login-box h1 { font-size: 20px; margin-bottom: 24px; text-align: center; color: #00d4aa; }
    .login-box input { width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #2a2a4a; background: #0d0d1a; color: #e0e0e0; font-size: 16px; margin-bottom: 16px; box-sizing: border-box; }
    .login-box button { width: 100%; padding: 12px; border-radius: 8px; border: none; background: #00d4aa; color: #0d0d1a; font-weight: 600; font-size: 16px; cursor: pointer; }
    .login-box button:hover { background: #00b894; }
    .error { color: #ff6b6b; font-size: 14px; text-align: center; margin-bottom: 12px; display: none; }
  </style>
</head>
<body>
  <div class="login-box">
    <h1>⚽ Superscout Admin</h1>
    <div class="error" id="error">Invalid password</div>
    <input type="password" id="password" placeholder="Admin password" autofocus>
    <button onclick="login()">Sign In</button>
  </div>
  <script>
    document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
    async function login() {
      const password = document.getElementById('password').value;
      const resp = await fetch('/api/admin/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (resp.ok) { window.location.href = '/api/admin'; }
      else { const data = await resp.json(); document.getElementById('error').textContent = data.error || 'Invalid password'; document.getElementById('error').style.display = 'block'; }
    }
  </script>
</body>
</html>`;
}

function dashboardPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Superscout Admin Dashboard</title>
  <style>${sharedStyles()}
    .header { display: flex; justify-content: space-between; align-items: center; padding: 16px 24px; border-bottom: 1px solid #2a2a4a; }
    .header h1 { font-size: 18px; color: #00d4aa; margin: 0; }
    .header button { padding: 8px 16px; border-radius: 8px; border: 1px solid #2a2a4a; background: transparent; color: #888; cursor: pointer; font-size: 13px; }
    .header button:hover { border-color: #ff6b6b; color: #ff6b6b; }

    .content { padding: 24px; max-width: 1200px; margin: 0 auto; }

    /* Table grid */
    .table-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; margin-bottom: 32px; }
    .table-card { background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 12px; padding: 16px; cursor: pointer; transition: border-color 0.2s; }
    .table-card:hover { border-color: #00d4aa; }
    .table-card.active { border-color: #00d4aa; background: #1a2a3e; }
    .table-card .name { font-size: 13px; color: #ccc; font-weight: 500; word-break: break-all; }
    .table-card .count { font-size: 28px; font-weight: 700; color: #fff; margin-top: 4px; }
    .table-card .count.zero { color: #555; }
    .table-card .loading { color: #555; font-size: 14px; }

    /* Data viewer */
    .viewer { background: #1a1a2e; border: 1px solid #2a2a4a; border-radius: 12px; overflow: hidden; }
    .viewer-header { padding: 16px; border-bottom: 1px solid #2a2a4a; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
    .viewer-header h2 { margin: 0; font-size: 16px; color: #00d4aa; }
    .viewer-controls { display: flex; gap: 8px; align-items: center; }
    .viewer-controls select, .viewer-controls input { padding: 6px 10px; border-radius: 6px; border: 1px solid #2a2a4a; background: #0d0d1a; color: #e0e0e0; font-size: 13px; }
    .viewer-controls button { padding: 6px 14px; border-radius: 6px; border: none; background: #00d4aa; color: #0d0d1a; font-weight: 600; font-size: 13px; cursor: pointer; }

    /* Results table */
    .results-wrap { overflow-x: auto; }
    .results-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .results-table th { text-align: left; padding: 10px 12px; background: #0d0d1a; color: #888; font-weight: 500; white-space: nowrap; position: sticky; top: 0; }
    .results-table td { padding: 8px 12px; border-top: 1px solid #1a1a2e; color: #ccc; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .results-table tr:hover td { background: #1a2a3e; }

    .empty-state { padding: 48px; text-align: center; color: #555; }

    /* Query box */
    .query-section { margin-top: 24px; }
    .query-section h3 { font-size: 14px; color: #888; margin-bottom: 8px; }
    .query-box { display: flex; gap: 8px; }
    .query-box textarea { flex: 1; padding: 12px; border-radius: 8px; border: 1px solid #2a2a4a; background: #0d0d1a; color: #e0e0e0; font-family: monospace; font-size: 13px; resize: vertical; min-height: 60px; }
    .query-box button { padding: 12px 20px; border-radius: 8px; border: none; background: #00d4aa; color: #0d0d1a; font-weight: 600; cursor: pointer; white-space: nowrap; }

    .status-bar { padding: 8px 16px; font-size: 12px; color: #555; border-top: 1px solid #2a2a4a; display: flex; justify-content: space-between; }

    @media (max-width: 600px) {
      .table-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
      .content { padding: 12px; }
      .viewer-header { flex-direction: column; align-items: flex-start; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚽ Superscout Admin</h1>
    <button onclick="logout()">Logout</button>
  </div>

  <div class="content">
    <!-- Table Overview -->
    <div class="table-grid" id="tableGrid"></div>

    <!-- Data Viewer -->
    <div class="viewer" id="viewer" style="display:none;">
      <div class="viewer-header">
        <h2 id="viewerTitle">Table</h2>
        <div class="viewer-controls">
          <select id="limitSelect">
            <option value="10">10 rows</option>
            <option value="25" selected>25 rows</option>
            <option value="50">50 rows</option>
            <option value="100">100 rows</option>
          </select>
          <button onclick="loadTable(currentTable)">Refresh</button>
        </div>
      </div>
      <div class="results-wrap" id="resultsWrap">
        <div class="empty-state">Select a table above</div>
      </div>
      <div class="status-bar">
        <span id="statusText"></span>
        <span id="countText"></span>
      </div>
    </div>

    <!-- Custom Query -->
    <div class="query-section">
      <h3>Custom Query</h3>
      <div class="query-box">
        <textarea id="queryInput" placeholder='{"table":"recommendations","select":"id,decision_type,gameweek","limit":10}'></textarea>
        <button onclick="runQuery()">Run</button>
      </div>
    </div>
  </div>

  <script>
    let currentTable = null;

    // Load table overview
    async function loadTables() {
      const grid = document.getElementById('tableGrid');
      grid.innerHTML = Array(12).fill('<div class="table-card"><div class="loading">Loading...</div></div>').join('');

      const resp = await fetch('/api/admin/api/tables');
      const tables = await resp.json();

      grid.innerHTML = tables.map(t => {
        return '<div class="table-card" id="card-' + t.name + '" data-table="' + t.name + '"><div class="name">' + t.name + '</div><div class="count ' + (t.count === 0 ? 'zero' : '') + '">' + (t.count >= 0 ? t.count : 'err') + '</div></div>';
      }).join('');
    }

    // Load table data
    async function loadTable(table) {
      currentTable = table;
      const viewer = document.getElementById('viewer');
      viewer.style.display = 'block';
      document.getElementById('viewerTitle').textContent = table;
      document.getElementById('resultsWrap').innerHTML = '<div class="empty-state">Loading...</div>';

      // Highlight active card
      document.querySelectorAll('.table-card').forEach(c => c.classList.remove('active'));
      document.getElementById('card-' + table)?.classList.add('active');

      const limit = document.getElementById('limitSelect').value;
      const resp = await fetch('/api/admin/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, limit: parseInt(limit), ascending: false, order_by: 'created_at' })
      });
      const result = await resp.json();
      renderTable(result);
    }

    // Run custom query
    async function runQuery() {
      try {
        var raw = document.getElementById('queryInput').value;
        raw = raw.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"').replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'");
        const input = JSON.parse(raw);
        const viewer = document.getElementById('viewer');
        viewer.style.display = 'block';
        document.getElementById('viewerTitle').textContent = input.table || 'Query Result';
        document.getElementById('resultsWrap').innerHTML = '<div class="empty-state">Running...</div>';

        const resp = await fetch('/api/admin/api/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input)
        });
        const result = await resp.json();
        renderTable(result);
      } catch (e) {
        document.getElementById('resultsWrap').innerHTML = '<div class="empty-state">Invalid JSON: ' + e.message + '</div>';
      }
    }

    // Render data table
    function renderTable(result) {
      const wrap = document.getElementById('resultsWrap');

      if (result.error) {
        wrap.innerHTML = '<div class="empty-state" style="color:#ff6b6b;">' + result.error + '</div>';
        return;
      }

      const rows = result.rows || [];
      if (rows.length === 0) {
        wrap.innerHTML = '<div class="empty-state">No rows found</div>';
        document.getElementById('statusText').textContent = '';
        document.getElementById('countText').textContent = 'Total: ' + (result.total || 0);
        return;
      }

      const cols = Object.keys(rows[0]);
      let html = '<table class="results-table"><thead><tr>';
      html += cols.map(c => '<th>' + c + '</th>').join('');
      html += '</tr></thead><tbody>';
      for (const row of rows) {
        html += '<tr>';
        html += cols.map(c => {
          let val = row[c];
          if (val === null) return '<td style="color:#555;">null</td>';
          if (typeof val === 'object') val = JSON.stringify(val);
          if (typeof val === 'string' && val.length > 80) val = val.substring(0, 80) + '…';
          return '<td title="' + String(val).replace(/"/g, '&quot;') + '">' + val + '</td>';
        }).join('');
        html += '</tr>';
      }
      html += '</tbody></table>';
      wrap.innerHTML = html;

      document.getElementById('statusText').textContent = 'Showing ' + rows.length + ' rows';
      document.getElementById('countText').textContent = 'Total: ' + (result.total ?? '?');
    }

    async function logout() {
      await fetch('/api/admin/api/logout', { method: 'POST' });
      window.location.href = '/api/admin/login';
    }

    // Init
    loadTables();

    document.getElementById('tableGrid').addEventListener('click', function(e) {
      var card = e.target.closest('.table-card');
      if (card && card.dataset.table) loadTable(card.dataset.table);
    });

  </script>
</body>
</html>`;
}

function sharedStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0d0d1a; color: #e0e0e0; min-height: 100vh; }
    ::-webkit-scrollbar { height: 6px; width: 6px; }
    ::-webkit-scrollbar-track { background: #0d0d1a; }
    ::-webkit-scrollbar-thumb { background: #2a2a4a; border-radius: 3px; }
  `;
}

export default router;
