/* 도구리 작업실 — build.mjs  (Vercel 빌드 단계에서 실행)
   사이트를 이렇게 조립해 public/ 에 내놓는다:
     1) 기준 파일:
        · GitHub에서 배포될 때(이 저장소를 받아 빌드 — 기본): 받아 온 저장소 파일 그대로. main에 푸시하면 그 커밋이 곧 사이트가 된다
        · 배포 묶음(build.mjs·package.json·vercel.json·api/)만 CLI로 올렸을 때: 공개 저장소 doguri25/doguri-studio 의 BASE_REF(기본 main) tarball
     2) 덮어쓰기:   Supabase 표 site_files 의 파일들을 그 위에 덮는다(큰 파일은 part로 나눠 저장)
     3) 살아 있는 내용(data/overrides.json, content/*.md)은 public/ 에서 빼고 api/content.js 가 Supabase에서 실시간으로 내보낸다
     4) 도메인 치환(OLD_HOST → SITE_HOST; 기본은 둘 다 doguri-studio.vercel.app 이라 생략됨), 자산 주소에 빌드 스탬프(?v=)를 새로 찍는다
   환경변수(선택): BASE_REF(묶음만 올릴 때) · SUPABASE_URL · SUPABASE_ANON_KEY · SITE_HOST  (없으면 아래 기본값) */
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';

const ENV = process.env;
const BASE_REPO = ENV.BASE_REPO || 'doguri25/doguri-studio';
const BASE_REF = ENV.BASE_REF || 'main';                                          // 묶음만 올렸을 때 받을 커밋·브랜치
const SUPABASE_URL = (ENV.SUPABASE_URL || 'https://rvzczdvxfzmlqbwzqeok.supabase.co').replace(/\/$/, '');
const SUPABASE_ANON_KEY = ENV.SUPABASE_ANON_KEY || 'sb_publishable_ND9Ki7e0Ke6A0w-myVCSfQ_idHw2ZNI';
const OLD_HOST = ENV.OLD_HOST || 'doguri-studio.vercel.app';
const SITE_HOST = ENV.SITE_HOST || 'doguri-studio.vercel.app';
const CWD = process.cwd();
const OUT = join(CWD, 'public');
/* 사이트 파일(index.html·assets/)이 빌드 폴더에 함께 있으면 저장소째 받은 것 → 그 파일을 기준으로 쓴다 */
const LOCAL = !ENV.BASE_TARBALL_URL && existsSync(join(CWD, 'index.html')) && existsSync(join(CWD, 'assets'));
const PRUNE = new Set(['.git', 'node_modules', 'public', '.vercel']);           // 저장소를 훑을 때 들어가지 않을 폴더
const LIVE = [/^data\/overrides\.json$/, /^content\/[a-z0-9-]+\.md$/];          // api/content.js 가 서빙 → 정적 파일에서 제외
const SKIP = [/^\.github\//, /^tools\//, /^README\.md$/, /^\.gitignore$/, /^api\//, /^vercel\.json$/, /^package(-lock)?\.json$/, /^build\.mjs$/, /^\.vercel/]; // 배포 설정·문서는 공개 파일로 내보내지 않는다
const TEXT_EXT = /\.(html|css|js|mjs|json|md|xml|txt|svg|webmanifest)$/i;

const log = (...a) => console.log('[build]', ...a);

async function main() {
  rmSync(OUT, { recursive: true, force: true }); mkdirSync(OUT, { recursive: true });

  /* 1) 기준 파일 */
  let nBase = 0, nSkip = 0, base;
  const take = (rel, data) => { if (SKIP.some(re => re.test(rel)) || LIVE.some(re => re.test(rel))) { nSkip++; return; } put(rel, data); nBase++; };
  if (LOCAL) {
    const sha = ENV.VERCEL_GIT_COMMIT_SHA || '';
    base = 'checkout' + (sha ? ':' + sha : '');
    log('base', 'checkout', ENV.VERCEL_GIT_COMMIT_REF || '(local)', sha.slice(0, 7));
    for (const f of walkSrc(CWD)) take(f.slice(CWD.length + 1).split('\\').join('/'), readFileSync(f));
  } else {
    const url = ENV.BASE_TARBALL_URL || `https://codeload.github.com/${BASE_REPO}/tar.gz/${BASE_REF}`;
    base = BASE_REF;
    log('base', BASE_REPO, BASE_REF.slice(0, 7));
    const r = await fetch(url, { headers: { 'User-Agent': 'doguriroom-build' } });
    if (!r.ok) throw new Error(`기준 스냅샷을 받지 못했습니다: ${r.status} ${url}`);
    const tar = gunzipSync(Buffer.from(await r.arrayBuffer()));
    for (const ent of untar(tar)) {
      const rel = ent.name.split('/').slice(1).join('/');               // 최상위 폴더(repo-sha/) 제거
      if (!rel || rel.endsWith('/')) continue;
      take(rel, ent.data);
    }
  }
  log(`base files: ${nBase} (skipped ${nSkip})`);

  /* 2) Supabase 덮어쓰기 — 실패해도 기준 스냅샷만으로 사이트는 살아 있어야 하므로 경고로 남기고 계속 */
  let nOver = 0, nDel = 0, patches = [], bad = [];
  const warnings = [];
  try {
    const rows = await sb(`/rest/v1/site_files?select=path,part,content,encoding,deleted&order=path.asc,part.asc`);
    const byPath = new Map();
    for (const row of rows) { if (!byPath.has(row.path)) byPath.set(row.path, []); byPath.get(row.path).push(row); }
    for (const [path, parts] of byPath) {
      if (!/^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(path) || path.includes('..')) { log('skip odd path', path); continue; }
      if (parts.some(p => p.deleted)) { const f = join(OUT, path); if (existsSync(f)) { rmSync(f); nDel++; } continue; }
      if (LIVE.some(re => re.test(path))) continue;                        // 살아 있는 내용은 site_content 가 담당
      const bufs = parts.sort((a, b) => a.part - b.part).map(decode);
      put(path, Buffer.concat(bufs)); nOver++;
    }
    log(`overrides: ${nOver} files, deleted ${nDel}`);
  } catch (e) { warnings.push('site_files: ' + (e && e.message || e)); log('WARN', warnings.at(-1)); }

  /* 2b) 작은 수정(site_patches): 파일을 통째로 다시 올리지 않고 문자열 치환. find 가 정확히 한 번 있어야 한다(all_matches면 전부) */
  try {
    patches = await sb(`/rest/v1/site_patches?select=id,path,find,replace,all_matches&enabled=is.true&order=id.asc`);
    for (const p of patches) {
      const f = join(OUT, p.path);
      if (!/^[A-Za-z0-9_][A-Za-z0-9_./-]*$/.test(p.path) || p.path.includes('..') || !existsSync(f)) { bad.push({ id: p.id, why: 'no file' }); log(`patch #${p.id} skip: 파일 없음 ${p.path}`); continue; }
      const s = readFileSync(f, 'utf8'); const n = s.split(p.find).length - 1;
      if (n === 0 || (n > 1 && !p.all_matches)) { bad.push({ id: p.id, why: `found ${n}` }); log(`patch #${p.id} skip: ${p.path} 에서 ${n}번 발견`); continue; }
      writeFileSync(f, p.all_matches ? s.split(p.find).join(p.replace) : s.replace(p.find, () => p.replace));
    }
    log(`patches: ${patches.length - bad.length}/${patches.length} applied`);
  } catch (e) { warnings.push('site_patches: ' + (e && e.message || e)); log('WARN', warnings.at(-1)); }

  /* 3) 도메인 치환 + 스탬프 */
  const stamp = new Date(Date.now() + 9 * 3600e3).toISOString().replace(/[-:T]/g, '').slice(0, 12);  // KST YYYYMMDDHHmm
  let nHost = 0;
  for (const file of walk(OUT)) {
    if (!TEXT_EXT.test(file) || /^apps\//.test(rel(file))) continue;      // 호스팅 앱(apps/) 원문은 건드리지 않는다
    let s = readFileSync(file, 'utf8'); const o = s;
    if (OLD_HOST !== SITE_HOST) s = s.split(OLD_HOST).join(SITE_HOST);
    if (/\.html$/i.test(file)) s = s.replace(/(\/assets\/(?:css|js)\/[a-z]+\.(?:css|js))(\?v=[0-9a-z]+)?/g, (_, p) => `${p}?v=${stamp}`);
    if (s !== o) { writeFileSync(file, s); nHost++; }
  }
  log(`rewritten text files: ${nHost}, stamp ${stamp}`);
  writeFileSync(join(OUT, '_build.json'), JSON.stringify({ base, stamp, at: new Date().toISOString(), node: process.version, overrides: nOver, deleted: nDel, patches: patches.length, patchesSkipped: bad, warnings }, null, 2));
  log('done →', OUT);
}

/* ─── Supabase REST (anon 읽기) ─── */
async function sb(path) {
  const r = await fetch(SUPABASE_URL + path, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + SUPABASE_ANON_KEY } });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${await r.text()}`);
  return r.json();
}
function decode(row) {
  const enc = row.encoding || 'utf8';
  if (enc === 'utf8') return Buffer.from(row.content, 'utf8');
  if (enc === 'base64') return Buffer.from(row.content.replace(/\s+/g, ''), 'base64');
  if (enc === 'gzip-base64') return gunzipSync(Buffer.from(row.content.replace(/\s+/g, ''), 'base64'));
  throw new Error('모르는 encoding: ' + enc);
}

/* ─── 파일 유틸 ─── */
function put(relPath, data) { const f = join(OUT, relPath); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, data); }
function rel(f) { return f.slice(OUT.length + 1).split('\\').join('/'); }
function* walk(dir) { for (const n of readdirSync(dir)) { const f = join(dir, n); if (statSync(f).isDirectory()) yield* walk(f); else yield f; } }
function* walkSrc(dir) { for (const n of readdirSync(dir)) { if (PRUNE.has(n)) continue; const f = join(dir, n); if (statSync(f).isDirectory()) yield* walkSrc(f); else yield f; } }

/* ─── 최소 tar 파서 (ustar/pax; GitHub tarball용) ─── */
function* untar(buf) {
  let off = 0, longName = null;
  while (off + 512 <= buf.length) {
    const h = buf.subarray(off, off + 512);
    if (h.every(b => b === 0)) break;
    const str = (a, b) => h.subarray(a, a + b).toString('utf8').replace(/\0.*$/s, '');
    const size = parseInt(str(124, 12).trim() || '0', 8);
    const type = String.fromCharCode(h[156] || 48);
    let name = str(0, 100); const prefix = str(345, 155); if (prefix) name = prefix + '/' + name;
    const data = buf.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if (type === 'L') { longName = data.toString('utf8').replace(/\0.*$/s, ''); continue; }   // GNU long name
    if (type === 'x' || type === 'g') {                                                        // pax 헤더: path= 만 본다
      const m = /\d+ path=([^\n]+)\n/.exec(data.toString('utf8')); if (type === 'x' && m) longName = m[1]; continue;
    }
    if (longName) { name = longName; longName = null; }
    if (type === '0' || type === '\0' || type === '7') yield { name, data };
  }
}

main().catch(e => {
  console.error('[build] 실패:', e);
  try { mkdirSync(OUT, { recursive: true }); writeFileSync(join(OUT, '_build.json'), JSON.stringify({ failed: true, error: String(e && e.stack || e), at: new Date().toISOString() }, null, 2)); } catch (e2) {}
  process.exit(1);
});
