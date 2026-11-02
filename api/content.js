/* 도구리 작업실 — api/content.js  (Vercel 서버리스 함수, 공개 읽기)
   관리 화면이 고치는 살아 있는 내용을 Supabase 표 site_content 에서 그대로 내보낸다. 배포 없이 즉시 반영.
     /data/overrides.json  → ?path=data/overrides.json   (vercel.json rewrite)
     /content/<slug>.md    → ?path=content/<slug>.md
   읽기는 anon 키(공개 읽기 정책)로 충분하다. */
const SUPABASE_URL = (process.env.SUPABASE_URL || 'https://rvzczdvxfzmlqbwzqeok.supabase.co').replace(/\/$/, '');
const ANON = process.env.SUPABASE_ANON_KEY || 'sb_publishable_ND9Ki7e0Ke6A0w-myVCSfQ_idHw2ZNI';
const OK = [/^data\/overrides\.json$/, /^content\/[a-z0-9-]+\.md$/];

module.exports = async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://x');
  const p = String(url.searchParams.get('path') || '');
  if (!OK.some(re => re.test(p))) { res.statusCode = 404; res.setHeader('Cache-Control', 'no-store'); return res.end('not found'); }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/site_content?path=eq.${encodeURIComponent(p)}&select=text,updated_at`, { headers: { apikey: ANON, Authorization: 'Bearer ' + ANON } });
    if (!r.ok) throw new Error('Supabase ' + r.status);
    const rows = await r.json();
    const isJson = /\.json$/.test(p);
    res.setHeader('Content-Type', isJson ? 'application/json; charset=utf-8' : 'text/markdown; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=86400');   // 앞단 60초 보관 + 이후 하루는 먼저 보여 주고 뒤에서 갱신(관리 화면 게시는 1분 안에 반영)
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (!rows.length) { res.statusCode = isJson ? 200 : 404; return res.end(isJson ? '{"apps":{}}' : ''); }   // overrides가 없으면 빈 덮어쓰기
    res.setHeader('Last-Modified', new Date(rows[0].updated_at).toUTCString());
    res.statusCode = 200; res.end(rows[0].text);
  } catch (e) {
    res.statusCode = 502; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify({ error: e.message || String(e) }));
  }
};
