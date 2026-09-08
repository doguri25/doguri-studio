/* 도구리 작업실 — admin.js
   브라우저는 /api/admin 하고만 이야기한다. GitHub 토큰은 Vercel 환경변수에만 있고 여기엔 없다.
   흐름: 로그인(구글 또는 비밀번호) → 세션 토큰(12시간, localStorage) → apps.json 읽기 → 작품 편집/새 작품
        → 이미지 축소 → 블롭 업로드(장당 1요청) → 커밋 1개 → Vercel 자동 배포 → 사이트에서 확인 */
(() => {
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const store={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}},del:k=>{try{localStorage.removeItem(k)}catch(e){}}};
const SKEY='dgr-admin-session';
let CFG=null;                // /api/admin?op=config
let SESSION=null;            // {token, exp, who}
let APPSJSON=null, SEL='card-novel', DIRTY=false;
let NEW=[]; // {id,file,name,url(blob preview)}

/* ═══════════════ API ═══════════════ */
async function api(op,body,opts={}){
  const r=await fetch('/api/admin?op='+encodeURIComponent(op),{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(SESSION&&!opts.noAuth?{'Authorization':'Bearer '+SESSION.token}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});
  let j={}; try{ j=await r.json(); }catch(e){}
  if(!r.ok){ if(r.status===401&&SESSION&&!opts.noAuth){ logout('세션이 끝났어요. 다시 들어와 주세요.'); } throw new Error(j.error||`${r.status} ${r.statusText}`); }
  return j;
}
async function readAppsJson(){ const j=await api('apps',{}); APPSJSON=JSON.parse(j.text); }
/* 파일 여러 개 + apps.json 을 커밋 하나로: 이미지는 장당 블롭 1요청, 나머지는 서버가 트리·커밋 처리 */
async function commitFiles(message, files /* [{path, base64|text}] */, deletions /* [path] */, onProgress){
  const out=[]; let done=0; const imgs=files.filter(f=>f.base64);
  for(const f of files){
    if(f.base64){ const b=await api('blob',{base64:f.base64}); out.push({path:f.path,sha:b.sha}); done++; onProgress&&onProgress(done,imgs.length,f.path); }
    else out.push({path:f.path,text:f.text});
  }
  const c=await api('commit',{message,files:out,deletions:deletions||[]});
  return c.sha;
}

/* ═══════════════ 로그인 ═══════════════ */
const st=(el,msg,cls)=>{ el.textContent=msg; el.className='status'+(cls?' '+cls:''); };
function loadSession(){ try{ const s=JSON.parse(store.get(SKEY)||'null'); if(s&&s.token&&s.exp>Date.now()+60000) SESSION=s; }catch(e){} }
function showSetup(){
  const box=$('#setup'); const notes=(CFG&&CFG.notes)||[];
  if(!notes.length){ box.hidden=true; return; }
  box.hidden=false; box.innerHTML=`<p><b>아직 설정이 덜 됐어요.</b></p>${notes.map(n=>`<p>· ${esc(n)}</p>`).join('')}<p>Vercel → 프로젝트 → <b>Settings → Environment Variables</b>에 넣고 <b>Redeploy</b> 하면 됩니다. 자세한 순서는 저장소의 README「관리 화면」에 있어요.</p>`;
}
function mountGoogle(clientId){
  const box=$('#lmGoogle'); box.hidden=false;
  const s=document.createElement('script'); s.src='https://accounts.google.com/gsi/client'; s.async=true; s.defer=true;
  s.onload=()=>{ try{
    google.accounts.id.initialize({client_id:clientId,callback:r=>login({credential:r.credential}),ux_mode:'popup',auto_select:false,itp_support:true,use_fedcm_for_prompt:true});
    google.accounts.id.renderButton($('#gsi'),{theme:'filled_black',size:'large',text:'signin_with',shape:'rectangular',width:260,locale:'ko'});
  }catch(e){ st($('#stLogin'),'구글 버튼을 만들지 못했습니다: '+e.message,'err'); } };
  s.onerror=()=>{ $('#gsi').innerHTML='<span class="hint">구글 로그인 스크립트를 불러오지 못했습니다. 네트워크를 확인해 주세요.</span>'; };
  document.head.appendChild(s);
}
async function login(body){
  st($('#stLogin'),'확인하는 중…');
  try{ const s=await api('login',body,{noAuth:true}); SESSION={token:s.token,exp:s.exp,who:s.who}; store.set(SKEY,JSON.stringify(SESSION)); await enter(); }
  catch(e){ st($('#stLogin'),e.message,'err'); }
}
$('#btnPw').addEventListener('click',()=>{ const v=$('#pw').value; if(!v){ st($('#stLogin'),'비밀번호를 적어 주세요.','err'); $('#pw').focus(); return; } login({password:v}); });
$('#pw').addEventListener('keydown',e=>{ if(e.key==='Enter') $('#btnPw').click(); });
function logout(msg){ SESSION=null; store.del(SKEY); $('#sessionBox').hidden=true; $('#loginBox').hidden=false; $('#pWorks').hidden=true; $('#pNew').hidden=true; $('#pw').value=''; st($('#stLogin'),msg||'나왔습니다.'); }
$('#btnLogout').addEventListener('click',()=>logout());
async function enter(){
  try{
    await readAppsJson();
    $('#loginBox').hidden=true; $('#sessionBox').hidden=false;
    const until=new Date(SESSION.exp); const hh=String(until.getHours()).padStart(2,'0'), mm=String(until.getMinutes()).padStart(2,'0');
    st($('#stSession'),`들어왔습니다 · ${SESSION.who==='google'?'구글 계정':'비밀번호'} · ${CFG.repo} (${CFG.branch}) · 앱 ${APPSJSON.apps.length}개 · ${hh}:${mm}까지 유효`,'ok');
    $('#pWorks').hidden=false; $('#pNew').hidden=false; buildAppSel(); renderWorks();
  }catch(e){ st($('#stLogin'),'들어가지 못했습니다: '+e.message,'err'); if(!SESSION) return; }
}
async function boot(){
  try{ CFG=await api('config'); }catch(e){ st($('#stLogin'),'관리 서버(/api/admin)에 닿지 못했습니다: '+e.message+' — Vercel에 api/ 폴더까지 올라갔는지 확인해 주세요.','err'); return; }
  showSetup();
  const canGoogle=!!CFG.google, canPw=!!CFG.password;
  $('#loginMethods').hidden=!(canGoogle||canPw); $('#lmPass').hidden=!canPw; $('#lmOr').hidden=!(canGoogle&&canPw);
  if(canGoogle) mountGoogle(CFG.google);
  loadSession();
  if(SESSION){ st($('#stLogin'),'지난 로그인을 이어가는 중…'); await enter(); }
  else st($('#stLogin'),(canGoogle||canPw)?'':'로그인 방법이 아직 없습니다.');
}

/* ═══════════════ 작품 목록 ═══════════════ */
function buildAppSel(){ const s=$('#appSel'); s.innerHTML=APPSJSON.apps.filter(a=>a.status!=='soon').map(a=>`<option value="${esc(a.slug)}">${esc(a.name)}</option>`).join(''); if(![...s.options].some(o=>o.value===SEL)) SEL=s.options[0]?.value||''; s.value=SEL; }
$('#appSel').addEventListener('change',e=>{ if(DIRTY&&!confirm('게시하지 않은 변경이 있어요. 버리고 넘어갈까요?')){ e.target.value=SEL; return; } SEL=e.target.value; DIRTY=false; renderWorks(); });
const app=()=>APPSJSON.apps.find(a=>a.slug===SEL);
function renderWorks(){
  const a=app(); const ws=a.works||[]; const box=$('#wlist');
  box.innerHTML=ws.length?ws.map((w,i)=>`<div class="witem"><div class="cv">${w.cards&&w.cards[0]?`<img src="${esc(w.cards[0])}" alt="">`:''}</div><div class="ti"><b>${esc(w.title||w.slug)}</b><span>${(w.cards||[]).length}장 · ${esc(w.date||'')} · ${esc(w.ratio||'1:1')}${w.blurb?' · '+esc(w.blurb):''}</span></div><div class="ops"><button type="button" class="ib" data-op="up" data-i="${i}" ${i===0?'disabled':''}>▲</button><button type="button" class="ib" data-op="down" data-i="${i}" ${i===ws.length-1?'disabled':''}>▼</button><button type="button" class="ib" data-op="edit" data-i="${i}">제목·소개</button><button type="button" class="ib danger" data-op="del" data-i="${i}">지우기</button></div></div>`).join(''):'<p class="empty">아직 작품집이 없습니다. 아래에서 첫 작품을 올려 보세요.</p>';
  $$('.ib',box).forEach(b=>b.addEventListener('click',()=>workOp(b.dataset.op,+b.dataset.i)));
  $('#btnSaveWorks').disabled=!DIRTY; st($('#stWorks'),DIRTY?'게시하지 않은 변경이 있습니다.':'');
}
let DELETED=[]; // 지운 작품의 slug (파일도 지우기 위해)
function workOp(op,i){ const a=app(); const ws=a.works||[]; const w=ws[i];
  if(op==='up'&&i>0){ [ws[i-1],ws[i]]=[ws[i],ws[i-1]]; }
  else if(op==='down'&&i<ws.length-1){ [ws[i+1],ws[i]]=[ws[i],ws[i+1]]; }
  else if(op==='edit'){ const t=prompt('제목',w.title||''); if(t===null)return; const d=prompt('날짜',w.date||''); if(d===null)return; const b=prompt('한 줄 소개 (비워도 됨)',w.blurb||''); if(b===null)return; w.title=t.trim()||w.title; w.date=d.trim(); w.blurb=b.trim(); }
  else if(op==='del'){ if(!confirm(`「${w.title||w.slug}」을(를) 작품집에서 지울까요? 이미지 파일도 함께 지워집니다.`))return; ws.splice(i,1); DELETED.push({app:SEL,slug:w.slug,cards:w.cards||[]}); }
  a.works=ws; DIRTY=true; renderWorks();
}
$('#btnSaveWorks').addEventListener('click',async()=>{
  const btn=$('#btnSaveWorks'); btn.disabled=true; st($('#stWorks'),'게시하는 중…');
  try{
    const deletions=[]; for(const d of DELETED){ for(const c of d.cards){ if(c.startsWith('/media/')) deletions.push(c.slice(1)); } }
    await commitFiles(`작품집 정리 (${app().name})`,[{path:'data/apps.json',text:JSON.stringify(APPSJSON,null,2)+'\n'}],deletions);
    DELETED=[]; DIRTY=false; renderWorks(); st($('#stWorks'),'게시했습니다. 약 1분 뒤 사이트에 반영돼요.','ok'); await readAppsJson();
  }catch(e){ st($('#stWorks'),'실패: '+e.message,'err'); btn.disabled=false; }
});

/* ═══════════════ 새 작품: 파일 담기 · 순서 ═══════════════ */
const drop=$('#drop'), cards=$('#cards');
function addFiles(list){ const arr=[...list].filter(f=>/^image\//.test(f.type)); arr.sort((a,b)=>a.name.localeCompare(b.name,'ko',{numeric:true})); for(const f of arr){ NEW.push({id:Math.random().toString(36).slice(2),file:f,name:f.name,url:URL.createObjectURL(f)}); } renderCards(); }
$('#files').addEventListener('change',e=>{ addFiles(e.target.files); e.target.value=''; });
['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.add('over'); }));
['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop',e=>addFiles(e.dataTransfer.files));
function renderCards(){
  cards.innerHTML=NEW.map((c,i)=>`<div class="cd" draggable="true" data-i="${i}"><img src="${c.url}" alt=""><span class="n ${i===0?'cover':''}">${String(i+1).padStart(2,'0')}</span><div class="ops"><button type="button" data-op="left" title="앞으로">◀</button><button type="button" data-op="right" title="뒤로">▶</button><button type="button" class="x" data-op="x" title="빼기">✕</button></div></div>`).join('');
  $$('.cd',cards).forEach(el=>{ const i=+el.dataset.i;
    $$('button',el).forEach(b=>b.addEventListener('click',()=>{ const op=b.dataset.op; if(op==='x'){ URL.revokeObjectURL(NEW[i].url); NEW.splice(i,1); } else if(op==='left'&&i>0){ [NEW[i-1],NEW[i]]=[NEW[i],NEW[i-1]]; } else if(op==='right'&&i<NEW.length-1){ [NEW[i+1],NEW[i]]=[NEW[i],NEW[i+1]]; } renderCards(); }));
    el.addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/plain',String(i)); el.classList.add('drag'); });
    el.addEventListener('dragend',()=>el.classList.remove('drag'));
    el.addEventListener('dragover',e=>{ e.preventDefault(); el.classList.add('over'); });
    el.addEventListener('dragleave',()=>el.classList.remove('over'));
    el.addEventListener('drop',e=>{ e.preventDefault(); e.stopPropagation(); el.classList.remove('over'); const from=+e.dataTransfer.getData('text/plain'); if(isNaN(from)||from===i)return; const [m]=NEW.splice(from,1); NEW.splice(i,0,m); renderCards(); });
  });
  $('#btnPublish').disabled=!NEW.length; st($('#stNew'),NEW.length?`${NEW.length}장 · 첫 장이 표지가 됩니다.`:'');
}
$('#btnClear').addEventListener('click',()=>{ NEW.forEach(c=>URL.revokeObjectURL(c.url)); NEW=[]; renderCards(); $('#log').textContent=''; $('#done').hidden=true; $('#bar').hidden=true; });

/* ═══════════════ 이미지 축소 → base64 ═══════════════ */
async function shrink(file,maxSide=1080){
  const bmp=await createImageBitmap(file).catch(()=>null); let img=bmp;
  if(!img){ img=await new Promise((res,rej)=>{ const im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=URL.createObjectURL(file); }); }
  const w=img.width,h=img.height; const s=Math.min(1,maxSide/Math.max(w,h)); const cw=Math.round(w*s),ch=Math.round(h*s);
  const cv=document.createElement('canvas'); cv.width=cw; cv.height=ch; cv.getContext('2d').drawImage(img,0,0,cw,ch);
  let blob=await new Promise(r=>cv.toBlob(r,'image/webp',.86)); let ext='webp';
  if(!blob||blob.type!=='image/webp'){ blob=await new Promise(r=>cv.toBlob(r,'image/jpeg',.88)); ext='jpg'; }
  const base64=await new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(String(fr.result).split(',')[1]); fr.onerror=rej; fr.readAsDataURL(blob); });
  return {base64,ext,size:blob.size,w:cw,h:ch};
}
function slugify(s){ return s.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,''); }
function autoSlug(){ const d=new Date(); const p=n=>String(n).padStart(2,'0'); return `w${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${Math.random().toString(36).slice(2,6)}`; }
const log=m=>{ const el=$('#log'); el.textContent+=m+'\n'; el.scrollTop=el.scrollHeight; };

/* ═══════════════ 게시 ═══════════════ */
$('#btnPublish').addEventListener('click',async()=>{
  const a=app(); if(!a) return;
  const title=$('#wTitle').value.trim(); if(!title){ st($('#stNew'),'제목을 적어 주세요.','err'); $('#wTitle').focus(); return; }
  let slug=slugify($('#wSlug').value.trim())||autoSlug(); const date=$('#wDate').value.trim(), ratio=$('#wRatio').value, blurb=$('#wBlurb').value.trim();
  if((a.works||[]).some(w=>w.slug===slug)){ st($('#stNew'),`폴더 이름 "${slug}"가 이미 있어요. 다른 이름을 적어 주세요.`,'err'); return; }
  const btn=$('#btnPublish'); btn.disabled=true; $('#btnClear').disabled=true; $('#log').textContent=''; $('#done').hidden=true; const bar=$('#bar'); bar.hidden=false; const fill=$('i',bar); fill.style.width='2%';
  try{
    log(`「${title}」 ${NEW.length}장 준비 중…`);
    const files=[]; const paths=[];
    for(let i=0;i<NEW.length;i++){ const r=await shrink(NEW[i].file); const name=`${String(i+1).padStart(2,'0')}.${r.ext}`; const path=`media/${a.slug}/works/${slug}/${name}`; files.push({path,base64:r.base64}); paths.push('/'+path); log(`  ${name}  ${r.w}×${r.h}  ${(r.size/1024).toFixed(0)} KB`); fill.style.width=(2+30*(i+1)/NEW.length)+'%'; }
    await readAppsJson(); // 최신 상태 위에 얹기
    const cur=app(); cur.works=cur.works||[]; cur.works.push({slug,title,date,ratio,blurb,cards:paths});
    files.push({path:'data/apps.json',text:JSON.stringify(APPSJSON,null,2)+'\n'});
    log('저장소에 올리는 중…');
    const sha=await commitFiles(`작품 추가: ${title} (${a.name})`,files,[],(d,n,p)=>{ fill.style.width=(32+60*d/n)+'%'; log(`  올림 ${d}/${n}`); });
    log(`커밋 완료 ${sha.slice(0,7)} · Vercel이 배포하는 중 (보통 30초~1분)`); fill.style.width='94%';
    // 사이트에 반영됐는지 확인
    let seen=false; for(let k=0;k<24&&!seen;k++){ await new Promise(r=>setTimeout(r,8000)); try{ const j=await (await fetch('/data/apps.json?_='+Date.now(),{cache:'no-store'})).json(); seen=!!(j.apps.find(x=>x.slug===a.slug)?.works||[]).find(w=>w.slug===slug); }catch(e){} log(seen?'사이트에 반영됐습니다.':`  아직 배포 중… (${(k+1)*8}초)`); }
    fill.style.width='100%';
    $('#done').hidden=false; $('#done').innerHTML=seen?`게시 완료! <a href="/project/${esc(a.slug)}" target="_blank" rel="noopener">${esc(a.name)} 상세에서 보기 →</a>`:`저장소에는 올라갔습니다. 배포가 조금 더 걸리는 것 같아요 — 1~2분 뒤 <a href="/project/${esc(a.slug)}" target="_blank" rel="noopener">${esc(a.name)} 상세</a>를 열어 확인해 주세요.`;
    NEW.forEach(c=>URL.revokeObjectURL(c.url)); NEW=[]; renderCards(); $('#wTitle').value=''; $('#wBlurb').value=''; $('#wSlug').value=''; DIRTY=false; renderWorks();
  }catch(e){ log('실패: '+e.message); st($('#stNew'),'게시 실패: '+e.message,'err'); btn.disabled=false; }
  $('#btnClear').disabled=false;
});

/* ═══════════════ 시작 ═══════════════ */
(function(){ const d=new Date(); $('#wDate').value=`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}`; })();
boot();
})();
