/* 도구리 작업실 — api/admin.js  (Vercel 서버리스 함수 · Supabase판)
   관리 화면(/admin)의 뒷문. 브라우저는 이 함수에게만 말하고, 저장소 열쇠(Supabase 서비스 키)는 Vercel 환경변수에만 있다.
   GitHub 커밋 대신 Supabase(표 site_content + 스토리지 site 버킷)에 쓰고, 사이트는 배포 없이 곧바로 반영한다.

   환경변수 (Vercel → Project → Settings → Environment Variables)
     SUPABASE_SERVICE_KEY  필수. Supabase → Project Settings → API → service_role (secret)
     SUPABASE_URL          선택. 기본 https://rvzczdvxfzmlqbwzqeok.supabase.co
     ADMIN_PASSWORD        로그인 방법 A: 비밀번호 (12자 이상 권장, 영문·숫자·기호)
     GOOGLE_CLIENT_ID      로그인 방법 B: 구글 OAuth 클라이언트 ID (…apps.googleusercontent.com)
     ADMIN_EMAIL           방법 B에서 허용할 구글 계정 (쉼표로 여러 개)
     SESSION_SECRET        선택. 로그인 세션 서명 키 (없으면 서비스 키에서 파생)
     KV_REST_API_URL / KV_REST_API_TOKEN   선택. Upstash Redis가 있으면 로그인 실패 잠금을 서버 재시작과 무관하게 기억
                           (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 이름도 인식)
     SITE_HOST             선택. 기본 doguri-studio.vercel.app (apps.json 을 읽어 올 사이트 주소)

   로그인 실패 잠금: 5회 틀리면 1시간 동안 그 IP와 전체에 시도 금지 (429 + lockedUntil).

   요청 (모두 JSON)
     GET  ?op=config                          → 어떤 로그인 방법이 켜져 있는지
     POST op=login  {credential} | {password} → {token, exp, who}
     POST op=apps                              → 사이트의 data/apps.json (Authorization: Bearer <token>)
     POST op=file   {path}                     → data/overrides.json · content/<slug>.md (없으면 missing:true)
     POST op=blob   {base64, path}             → {sha}  이미지 1장을 스토리지의 그 경로에
     POST op=commit {message, files:[{path,sha}|{path,text}], deletions:[path]} → {sha}
   쓸 수 있는 경로: media/<앱>/*.webp|jpg|png(스크린샷·대표 이미지, /shots) · media/<앱>/works/<작품>/*.webp|jpg|png(작품) · data/overrides.json · content/<앱>.md  (apps.json은 읽기만)
*/
const crypto = require('crypto');

const ENV = process.env;
const SUPABASE_URL = (ENV.SUPABASE_URL || 'https://rvzczdvxfzmlqbwzqeok.supabase.co').replace(/\/$/, '');
const SERVICE_KEY = ENV.SUPABASE_SERVICE_KEY || ENV.SUPABASE_SERVICE_ROLE_KEY || '';
const SITE_HOST = ENV.SITE_HOST || 'doguri-studio.vercel.app';
const SITE_PROTO = ENV.SITE_PROTO || 'https';           // 로컬 검증용
const BUCKET = 'site';
const SESSION_HOURS = 12;
const MAX_BLOB = 3 * 1024 * 1024;           // base64 기준 3MB
const OK_WRITE_IMG = /^media\/[a-z0-9-]+\/(?:works\/[a-z0-9-]+\/)?[a-z0-9-]+\.(webp|jpe?g|png)$/i;  // media/<앱>/<이름>(스크린샷) 또는 media/<앱>/works/<작품>/<이름>(작품)
const OK_WRITE = [OK_WRITE_IMG, /^data\/overrides\.json$/, /^content\/[a-z0-9-]+\.md$/];  // apps.json은 코드와 함께 배포되는 기본값이라 관리 화면이 건드리지 않는다
const OK_DELETE = [OK_WRITE_IMG];
const OK_READ = [/^data\/apps\.json$/, /^data\/overrides\.json$/, /^content\/[a-z0-9-]+\.md$/];

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
    if (op === 'login') return send(res, 200, await login(body, req));
    const who = auth(req);
    if (!who) return send(res, 401, { error: '로그인이 필요합니다' });
    if (!SERVICE_KEY) return send(res, 500, { error: 'Vercel 환경변수 SUPABASE_SERVICE_KEY가 없습니다' });
    if (op === 'apps') return send(res, 200, await readApps(req));
    if (op === 'file') return send(res, 200, await readFile(body, req));
    if (op === 'blob') return send(res, 200, await makeBlob(body));
    if (op === 'commit') return send(res, 200, await commit(body, who));
    return send(res, 400, { error: '모르는 요청: ' + op });
  } catch (e) {
    return send(res, e.status || 500, { error: e.message || String(e), ...(e.extra || {}) });
  }
};

/* ───────────── 설정 ───────────── */
function config() {
  const google = ENV.GOOGLE_CLIENT_ID && ENV.ADMIN_EMAIL ? ENV.GOOGLE_CLIENT_ID : null;
  const notes = [];
  if (!SERVICE_KEY) notes.push('SUPABASE_SERVICE_KEY 환경변수가 없어 아직 게시할 수 없습니다.');
  if (ENV.GOOGLE_CLIENT_ID && !ENV.ADMIN_EMAIL) notes.push('GOOGLE_CLIENT_ID는 있지만 ADMIN_EMAIL이 없어 구글 로그인을 끕니다.');
  if (!google && !ENV.ADMIN_PASSWORD) notes.push('로그인 방법이 없습니다. ADMIN_PASSWORD 또는 GOOGLE_CLIENT_ID+ADMIN_EMAIL을 넣어 주세요.');
  return { google, password: !!ENV.ADMIN_PASSWORD, ready: !!SERVICE_KEY, store: 'supabase', bucket: BUCKET, notes };
}

/* ───────────── 로그인 · 세션 ───────────── */
function secret() {
  return ENV.SESSION_SECRET || crypto.createHash('sha256').update('dgr-session|' + SERVICE_KEY + '|' + (ENV.ADMIN_PASSWORD || '')).digest('hex');
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
/* ───────────── 로그인 실패 잠금 ─────────────
   5회 실패 → 1시간 잠금. 상태는 이 함수 인스턴스의 메모리에, Upstash Redis가 연결돼 있으면 거기에도 둔다(인스턴스가 바뀌어도 유지). */
const LOCK_MAX = 5, LOCK_SEC = 60 * 60;
const MEM = new Map();                       // key → {n, first, until}
const KV_URL = ENV.KV_REST_API_URL || ENV.UPSTASH_REDIS_REST_URL, KV_TOKEN = ENV.KV_REST_API_TOKEN || ENV.UPSTASH_REDIS_REST_TOKEN;
async function kv(cmd) {
  if (!KV_URL || !KV_TOKEN) return null;
  try { const r = await fetch(KV_URL, { method: 'POST', headers: { 'Authorization': 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) }); const j = await r.json(); return j.result; } catch (e) { return null; }
}
function clientKey(req) { return 'ip:' + (String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim() || 'unknown'); }
async function lockedUntil(key) {
  const now = Date.now(); const m = MEM.get(key);
  if (m && m.until > now) return m.until;
  if (KV_URL) { const ttl = await kv(['TTL', 'lock:' + key]); if (typeof ttl === 'number' && ttl > 0) return now + ttl * 1000; }
  return 0;
}
async function noteFail(key) {
  const now = Date.now(); let m = MEM.get(key);
  if (!m || m.first + LOCK_SEC * 1000 < now) m = { n: 0, first: now, until: 0 };
  m.n++; if (m.n >= LOCK_MAX) m.until = now + LOCK_SEC * 1000; MEM.set(key, m);
  let n = m.n;
  if (KV_URL) { const c = await kv(['INCR', 'fail:' + key]); if (typeof c === 'number') { n = Math.max(n, c); if (c === 1) await kv(['EXPIRE', 'fail:' + key, LOCK_SEC]); if (c >= LOCK_MAX) await kv(['SET', 'lock:' + key, '1', 'EX', LOCK_SEC]); } }
  return { n, until: n >= LOCK_MAX ? now + LOCK_SEC * 1000 : 0, left: Math.max(0, LOCK_MAX - n) };
}
async function clearFail(key) { MEM.delete(key); if (KV_URL) await kv(['DEL', 'fail:' + key]); }
async function guardLock(req) {
  const until = Math.max(await lockedUntil(clientKey(req)), await lockedUntil('all'));
  if (until) { const e = err(429, `틀린 시도가 ${LOCK_MAX}회를 넘어 잠겼습니다. ${Math.ceil((until - Date.now()) / 60000)}분 뒤 다시 해 주세요.`); e.extra = { lockedUntil: until }; throw e; }
}
async function failAndMaybeLock(req, message) {
  const a = await noteFail(clientKey(req)), b = await noteFail('all');
  const until = Math.max(a.until, b.until); await sleep(700);
  if (until) { const e = err(429, `${LOCK_MAX}회 틀려서 1시간 동안 잠겼습니다.`); e.extra = { lockedUntil: until }; throw e; }
  const left = Math.min(a.left, b.left); const e = err(401, `${message} (남은 시도 ${left}회)`); e.extra = { attemptsLeft: left }; throw e;
}

async function login(body, req) {
  await guardLock(req);
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
    if (!allowed.some(a => same(a, email))) await failAndMaybeLock(req, '이 구글 계정은 관리자가 아닙니다');
    await clearFail(clientKey(req)); await clearFail('all'); return issue('google');
  }
  if (typeof body.password === 'string') {
    if (!ENV.ADMIN_PASSWORD) throw err(400, '비밀번호 로그인이 설정되지 않았습니다');
    if (body.password.length > 256 || !same(body.password, ENV.ADMIN_PASSWORD)) await failAndMaybeLock(req, '비밀번호가 맞지 않습니다');
    await clearFail(clientKey(req)); await clearFail('all'); return issue('password');
  }
  throw err(400, '로그인 정보가 없습니다');
}

/* ───────────── 저장소: Supabase (표 site_content + 스토리지 버킷 site) ─────────────
   GitHub 커밋 대신 여기로 쓴다. 텍스트(overrides.json, content/<slug>.md)는 site_content 표에, 이미지는 스토리지 site 버킷의 같은 경로에.
   사이트는 /data/overrides.json·/content/*.md 를 api/content.js 로, /media/* 중 정적 파일에 없는 것은 스토리지로 받아 간다(vercel.json rewrite). */
const SB_HEADERS = () => ({ apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY });
async function sb(path, opts = {}) {
  const r = await fetch(SUPABASE_URL + path, { ...opts, headers: { ...SB_HEADERS(), ...(opts.headers || {}) } });
  if (!r.ok) { let m = ''; try { const j = await r.json(); m = j.message || j.error || j.msg || ''; } catch (e) {} throw err(502, `Supabase ${r.status} ${m || r.statusText}`.trim()); }
  const t = await r.text(); try { return t ? JSON.parse(t) : null; } catch (e) { return t; }
}
async function readApps(req) { return readFile({ path: 'data/apps.json' }, req); }
/* 텍스트 파일 하나. apps.json 은 코드와 함께 배포되는 정적 파일이라 사이트 자신에게서 받고, 나머지는 site_content 표에서 */
async function readFile(body, req) {
  const p = String(body.path || '');
  if (!OK_READ.some(re => re.test(p))) throw err(400, '읽을 수 없는 경로: ' + p);
  if (p === 'data/apps.json') {
    const host = String(req.headers['x-forwarded-host'] || req.headers['host'] || SITE_HOST).split(',')[0].trim();
    for (const h of [...new Set([host, SITE_HOST])]) {
      try { const r = await fetch(`${SITE_PROTO}://${h}/data/apps.json?_=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } }); if (r.ok) return { sha: null, text: await r.text() }; } catch (e) {}
    }
    throw err(502, '사이트의 data/apps.json 을 읽지 못했습니다');
  }
  const rows = await sb(`/rest/v1/site_content?path=eq.${encodeURIComponent(p)}&select=text,updated_at`);
  if (!rows || !rows.length) return { sha: null, text: '', missing: true };
  return { sha: rows[0].updated_at, text: rows[0].text };
}
/* 이미지 1장 → 스토리지의 최종 경로에 바로 올린다(관리 화면이 path 를 함께 보낸다). 돌려주는 sha 는 내용의 sha1 */
async function makeBlob(body) {
  const b64 = String(body.base64 || ''), p = String(body.path || '');
  if (!b64 || b64.length > MAX_BLOB || !/^[A-Za-z0-9+/=\s]+$/.test(b64)) throw err(400, '이미지 데이터가 비었거나 너무 큽니다 (3MB 이하)');
  if (!OK_WRITE_IMG.test(p)) throw err(400, '이미지를 올릴 수 없는 경로: ' + p);
  const buf = Buffer.from(b64.replace(/\s+/g, ''), 'base64');
  const mime = sniff(buf); if (!mime) throw err(400, 'webp·jpg·png 이미지만 올릴 수 있습니다');
  await sb(`/storage/v1/object/${BUCKET}/${p}`, { method: 'POST', headers: { 'Content-Type': mime, 'x-upsert': 'true', 'Cache-Control': 'max-age=86400' }, body: buf });
  return { sha: crypto.createHash('sha1').update(buf).digest('hex'), path: p, size: buf.length };
}
function sniff(b) {
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF) return 'image/jpeg';
  if (b[0] === 0x89 && b.toString('ascii', 1, 4) === 'PNG') return 'image/png';
  return null;
}
/* 게시: 텍스트는 site_content 에 upsert, 이미지는 이미 올라가 있는지 확인, 지울 이미지는 스토리지에서 제거, 기록 한 줄 */
async function commit(body, who) {
  const files = Array.isArray(body.files) ? body.files : [];
  const deletions = Array.isArray(body.deletions) ? body.deletions.map(String) : [];
  const message = String(body.message || '관리 화면에서 게시').slice(0, 200);
  if (!files.length && !deletions.length) throw err(400, '올릴 파일이 없습니다');
  for (const f of files) { if (!f || typeof f.path !== 'string' || !OK_WRITE.some(re => re.test(f.path))) throw err(400, '허용되지 않은 경로: ' + (f && f.path)); }
  for (const p of deletions) { if (!OK_DELETE.some(re => re.test(p))) throw err(400, '지울 수 없는 경로: ' + p); }
  for (const f of files) { if (/\.json$/.test(f.path) && typeof f.text === 'string') { try { JSON.parse(f.text); } catch (e) { throw err(400, f.path + '이 올바른 JSON이 아닙니다'); } } }

  const texts = files.filter(f => typeof f.text === 'string');
  const imgs = files.filter(f => typeof f.text !== 'string');
  for (const f of imgs) {                                   // 올라갔는지만 확인 (관리 화면이 op=blob 으로 먼저 올린다)
    if (!OK_WRITE_IMG.test(f.path)) throw err(400, '이미지 경로가 아닙니다: ' + f.path);
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${f.path}`, { method: 'HEAD', headers: SB_HEADERS() });
    if (r.status === 404 || r.status === 400) throw err(400, '이미지가 아직 올라가지 않았습니다: ' + f.path);
  }
  if (texts.length) {
    await sb(`/rest/v1/site_content?on_conflict=path`, { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(texts.map(f => ({ path: f.path, text: f.text, updated_by: who || 'admin', updated_at: new Date().toISOString() }))) });
  }
  if (deletions.length) {
    try { await sb(`/storage/v1/object/${BUCKET}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: deletions }) }); }
    catch (e) { /* 저장소(GitHub 스냅샷)에만 있던 옛 이미지는 스토리지에 없어 실패할 수 있다 — 목록에서 빠지면 그만이라 무시 */ }
  }
  let id = Date.now().toString(36);
  try { const row = await sb(`/rest/v1/publish_log`, { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ who: who || 'admin', message, files: files.map(f => f.path), deletions }) }); if (row && row[0]) id = 'p' + String(row[0].id).padStart(6, '0'); } catch (e) {}
  return { sha: id, texts: texts.length, images: imgs.length, deleted: deletions.length };
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
