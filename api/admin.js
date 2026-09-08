/* 도구리 작업실 — api/admin.js  (Vercel 서버리스 함수)
   관리 화면(/admin)의 뒷문. 브라우저는 이 함수에게만 말하고, GitHub 토큰은 Vercel 환경변수(GITHUB_TOKEN)에만 있다.

   환경변수 (Vercel → Project → Settings → Environment Variables)
     GITHUB_TOKEN      필수. fine-grained 토큰 (Contents: Read and write, 사이트 저장소만)
     GITHUB_REPO       선택. 기본 doguri25/doguri-studio
     GITHUB_BRANCH     선택. 기본 main
     ADMIN_PASSWORD    로그인 방법 A: 비밀번호 (12자 이상 권장)
     GOOGLE_CLIENT_ID  로그인 방법 B: 구글 OAuth 클라이언트 ID (…apps.googleusercontent.com)
     ADMIN_EMAIL       방법 B에서 허용할 구글 계정 (쉼표로 여러 개)
     SESSION_SECRET    선택. 로그인 세션 서명 키 (없으면 GITHUB_TOKEN에서 파생)

   요청 (모두 JSON)
     GET  ?op=config                         → 어떤 로그인 방법이 켜져 있는지
     POST op=login  {credential} | {password} → {token, exp, who}
     POST op=apps                             → 저장소의 data/apps.json (Authorization: Bearer <token>)
     POST op=blob   {base64}                  → {sha}  이미지 1장을 블롭으로
     POST op=commit {message, files:[{path,sha}|{path,text}], deletions:[path]} → {sha}
*/
const crypto = require('crypto');

const ENV = process.env;
const REPO = ENV.GITHUB_REPO || 'doguri25/doguri-studio';
const BRANCH = ENV.GITHUB_BRANCH || 'main';
const SESSION_HOURS = 12;
const MAX_BLOB = 3 * 1024 * 1024;           // base64 기준 3MB
const OK_WRITE = [/^media\/[a-z0-9-]+\/works\/[a-z0-9-]+\/[a-z0-9-]+\.(webp|jpe?g|png)$/i, /^data\/apps\.json$/];
const OK_DELETE = [/^media\/[a-z0-9-]+\/works\/[a-z0-9-]+\/[a-z0-9-]+\.(webp|jpe?g|png)$/i];

module.exports = async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://x');
  let body = {};
  try { body = await readBody(req); } catch (e) { return send(res, 400, { error: '본문을 읽지 못했습니다' }); }
  const op = url.searchParams.get('op') || body.op || '';
  try {
    if (req.method === 'GET') {
      if (op === 'config') return send(res, 200, config());
      return send(res, 405, { error: 'GET은 op=config만 받습니다' });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'POST만 받습니다' });
    if (op === 'login') return send(res, 200, await login(body));
    const who = auth(req);
    if (!who) return send(res, 401, { error: '로그인이 필요합니다' });
    if (!ENV.GITHUB_TOKEN) return send(res, 500, { error: 'Vercel 환경변수 GITHUB_TOKEN이 없습니다' });
    if (op === 'apps') return send(res, 200, await readApps());
    if (op === 'blob') return send(res, 200, await makeBlob(body));
    if (op === 'commit') return send(res, 200, await commit(body));
    return send(res, 400, { error: '모르는 요청: ' + op });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message || String(e) });
  }
};

/* ───────────── 설정 ───────────── */
function config() {
  const google = ENV.GOOGLE_CLIENT_ID && ENV.ADMIN_EMAIL ? ENV.GOOGLE_CLIENT_ID : null;
  const notes = [];
  if (!ENV.GITHUB_TOKEN) notes.push('GITHUB_TOKEN 환경변수가 없어 아직 게시할 수 없습니다.');
  if (ENV.GOOGLE_CLIENT_ID && !ENV.ADMIN_EMAIL) notes.push('GOOGLE_CLIENT_ID는 있지만 ADMIN_EMAIL이 없어 구글 로그인을 끕니다.');
  if (!google && !ENV.ADMIN_PASSWORD) notes.push('로그인 방법이 없습니다. ADMIN_PASSWORD 또는 GOOGLE_CLIENT_ID+ADMIN_EMAIL을 넣어 주세요.');
  return { google, password: !!ENV.ADMIN_PASSWORD, ready: !!ENV.GITHUB_TOKEN, repo: REPO, branch: BRANCH, notes };
}

/* ───────────── 로그인 · 세션 ───────────── */
function secret() {
  return ENV.SESSION_SECRET || crypto.createHash('sha256').update('dgr-session|' + (ENV.GITHUB_TOKEN || '') + '|' + (ENV.ADMIN_PASSWORD || '')).digest('hex');
}
function b64u(s) { return Buffer.from(s).toString('base64url'); }
function sign(payload) { return crypto.createHmac('sha256', secret()).update(payload).digest('base64url'); }
function issue(who) {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const payload = b64u(JSON.stringify({ exp, who, n: crypto.randomBytes(6).toString('hex') }));
  return { token: payload + '.' + sign(payload), exp, who };
}
function auth(req) {
  const h = String(req.headers['authorization'] || '');
  const m = /^Bearer\s+([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(h);
  if (!m) return null;
  const good = sign(m[1]);
  if (good.length !== m[2].length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(m[2]))) return null;
  let p; try { p = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')); } catch (e) { return null; }
  if (!p || typeof p.exp !== 'number' || p.exp < Date.now()) return null;
  return p.who || 'admin';
}
function same(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
async function login(body) {
  if (body.credential) {
    if (!ENV.GOOGLE_CLIENT_ID || !ENV.ADMIN_EMAIL) throw err(400, '구글 로그인이 설정되지 않았습니다');
    const cred = String(body.credential);
    if (cred.length > 4096 || !/^[A-Za-z0-9_.-]+$/.test(cred)) throw err(400, '구글 자격 증명 형식이 이상합니다');
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(cred));
    const info = await r.json().catch(() => ({}));
    if (!r.ok) throw err(401, '구글이 로그인을 확인해 주지 않았습니다');
    const issOk = info.iss === 'accounts.google.com' || info.iss === 'https://accounts.google.com';
    if (!issOk || info.aud !== ENV.GOOGLE_CLIENT_ID) throw err(401, '이 사이트용 구글 로그인이 아닙니다');
    if (String(info.email_verified) !== 'true') throw err(401, '확인된 구글 계정이 아닙니다');
    const allowed = ENV.ADMIN_EMAIL.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const email = String(info.email || '').toLowerCase();
    if (!allowed.some(a => same(a, email))) { await sleep(600); throw err(403, '이 구글 계정은 관리자가 아닙니다'); }
    return issue('google');
  }
  if (typeof body.password === 'string') {
    if (!ENV.ADMIN_PASSWORD) throw err(400, '비밀번호 로그인이 설정되지 않았습니다');
    if (body.password.length > 256 || !same(body.password, ENV.ADMIN_PASSWORD)) { await sleep(900); throw err(401, '비밀번호가 맞지 않습니다'); }
    return issue('password');
  }
  throw err(400, '로그인 정보가 없습니다');
}

/* ───────────── GitHub ───────────── */
const API = 'https://api.github.com';
async function gh(path, opts = {}) {
  const r = await fetch(API + path, {
    ...opts,
    headers: { 'Authorization': 'Bearer ' + ENV.GITHUB_TOKEN, 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'doguri-studio-admin', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) }
  });
  if (!r.ok) { let m = ''; try { m = (await r.json()).message || ''; } catch (e) {} throw err(502, `GitHub ${r.status} ${m || r.statusText}`.trim()); }
  return r.status === 204 ? null : r.json();
}
const repo = () => `/repos/${REPO}`;
async function readApps() {
  const j = await gh(`${repo()}/contents/data/apps.json?ref=${encodeURIComponent(BRANCH)}`);
  const text = Buffer.from(String(j.content || '').replace(/\n/g, ''), 'base64').toString('utf8');
  return { sha: j.sha, text };
}
async function makeBlob(body) {
  const b64 = String(body.base64 || '');
  if (!b64 || b64.length > MAX_BLOB || !/^[A-Za-z0-9+/=\s]+$/.test(b64)) throw err(400, '이미지 데이터가 비었거나 너무 큽니다 (3MB 이하)');
  const blob = await gh(`${repo()}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: b64, encoding: 'base64' }) });
  return { sha: blob.sha };
}
async function commit(body) {
  const files = Array.isArray(body.files) ? body.files : [];
  const deletions = Array.isArray(body.deletions) ? body.deletions.map(String) : [];
  const message = String(body.message || '관리 화면에서 게시').slice(0, 200);
  if (!files.length && !deletions.length) throw err(400, '올릴 파일이 없습니다');
  for (const f of files) { if (!f || typeof f.path !== 'string' || !OK_WRITE.some(re => re.test(f.path))) throw err(400, '허용되지 않은 경로: ' + (f && f.path)); }
  for (const p of deletions) { if (!OK_DELETE.some(re => re.test(p))) throw err(400, '지울 수 없는 경로: ' + p); }
  if (files.some(f => f.path === 'data/apps.json')) { try { JSON.parse(files.find(f => f.path === 'data/apps.json').text); } catch (e) { throw err(400, 'apps.json이 올바른 JSON이 아닙니다'); } }

  const ref = await gh(`${repo()}/git/ref/heads/${encodeURIComponent(BRANCH)}`); const headSha = ref.object.sha;
  const head = await gh(`${repo()}/git/commits/${headSha}`); const baseTree = head.tree.sha;
  const tree = [];
  for (const f of files) {
    let sha = f.sha;
    if (!sha) {
      if (typeof f.text !== 'string') throw err(400, 'sha도 text도 없는 파일: ' + f.path);
      const blob = await gh(`${repo()}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: f.text, encoding: 'utf-8' }) });
      sha = blob.sha;
    }
    if (!/^[0-9a-f]{40}$/.test(String(sha))) throw err(400, '블롭 sha가 이상합니다: ' + f.path);
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha });
  }
  for (const p of deletions) tree.push({ path: p, mode: '100644', type: 'blob', sha: null });
  const newTree = await gh(`${repo()}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: baseTree, tree }) });
  const c = await gh(`${repo()}/git/commits`, { method: 'POST', body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] }) });
  await gh(`${repo()}/git/refs/heads/${encodeURIComponent(BRANCH)}`, { method: 'PATCH', body: JSON.stringify({ sha: c.sha, force: false }) });
  return { sha: c.sha };
}

/* ───────────── 유틸 ───────────── */
function err(status, message) { const e = new Error(message); e.status = status; return e; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
async function readBody(req) {
  if (req.method !== 'POST') return {};
  if (req.body !== undefined) {                       // Vercel이 미리 파싱해 준 경우
    if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
    if (Buffer.isBuffer(req.body)) return req.body.length ? JSON.parse(req.body.toString('utf8')) : {};
    return req.body || {};
  }
  const chunks = []; let size = 0;
  for await (const ch of req) { size += ch.length; if (size > 4 * 1024 * 1024) throw err(413, '요청이 너무 큽니다'); chunks.push(ch); }
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}
