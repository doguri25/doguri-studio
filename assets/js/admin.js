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
/* 비밀번호는 영문·숫자·기호만: 한글(IME)이 들어오면 즉시 지우고 알려 준다 */
(function(){ const pw=$('#pw'), hint=$('#pwHint'); let t=null;
  const clean=()=>{ const v=pw.value, c=v.replace(/[^\x20-\x7E]/g,''); if(c!==v){ pw.value=c; hint.classList.add('on'); clearTimeout(t); t=setTimeout(()=>hint.classList.remove('on'),2600); } };
  ['input','compositionend','change','blur'].forEach(ev=>pw.addEventListener(ev,clean)); })();
const PANELS=['#pWorks','#pNew','#pText'];
function logout(msg){ SESSION=null; store.del(SKEY); $('#sessionBox').hidden=true; $('#loginBox').hidden=false; PANELS.forEach(id=>$(id).hidden=true); $('#pw').value=''; st($('#stLogin'),msg||'나왔습니다.'); }
$('#btnLogout').addEventListener('click',()=>logout());
async function enter(){
  try{
    await readAppsJson();
    $('#loginBox').hidden=true; $('#sessionBox').hidden=false;
    const until=new Date(SESSION.exp); const hh=String(until.getHours()).padStart(2,'0'), mm=String(until.getMinutes()).padStart(2,'0');
    st($('#stSession'),`들어왔습니다 · ${SESSION.who==='google'?'구글 계정':'비밀번호'} · ${CFG.repo} (${CFG.branch}) · 앱 ${APPSJSON.apps.length}개 · ${hh}:${mm}까지 유효`,'ok');
    PANELS.forEach(id=>$(id).hidden=false); buildAppSel(); renderWorks(); buildTextSel(); loadText();
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
$('#appSel').addEventListener('change',e=>{ if(DIRTY&&!confirm('게시하지 않은 변경이 있어요. 버리고 넘어갈까요?')){ e.target.value=SEL; return; } SEL=e.target.value; discardWorks(); renderWorks(); });
const app=()=>APPSJSON.apps.find(a=>a.slug===SEL);
const ratioAR=r=>{ const m=String(r||'1:1').split(':'); return `${parseFloat(m[0])||1}/${parseFloat(m[1])||1}`; };
let DELETED=[];   // 지운 작품 {app,slug,cards}
let DELFILES=[];  // 작품에서 뺀 카드 파일 경로 (media/...)
let ADDS=[];      // 작품에 더한 카드 {path, base64}
let EDIT=null;    // 카드 편집 중인 작품 {i, list:[{src,path?,base64?,ext?,url?,gone}]}
function discardWorks(){ DIRTY=false; DELETED=[]; DELFILES=[]; ADDS=[]; EDIT=null; }
function renderWorks(){
  const a=app(); const ws=a.works||[]; const box=$('#wlist');
  box.innerHTML=ws.length?ws.map((w,i)=>`<div class="witem ${EDIT&&EDIT.i===i?'editing':''}" data-i="${i}"><div class="cv" style="aspect-ratio:${ratioAR(w.ratio)}">${w.cards&&w.cards[0]?`<img src="${esc(w.cards[0])}" alt="">`:''}</div><div class="ti"><b>${esc(w.title||w.slug)}</b><span>${(w.cards||[]).length}장 · ${esc(w.date||'')} · ${esc(w.ratio||'1:1')}${w.blurb?' · '+esc(w.blurb):''}</span></div><div class="ops"><button type="button" class="ib" data-op="up" data-i="${i}" ${i===0?'disabled':''}>▲</button><button type="button" class="ib" data-op="down" data-i="${i}" ${i===ws.length-1?'disabled':''}>▼</button><button type="button" class="ib" data-op="edit" data-i="${i}">제목·소개·비율</button><button type="button" class="ib" data-op="cards" data-i="${i}">${EDIT&&EDIT.i===i?'카드 편집 닫기':'카드 편집'}</button><button type="button" class="ib danger" data-op="del" data-i="${i}">지우기</button></div>${EDIT&&EDIT.i===i?editHTML(w):''}</div>`).join(''):'<p class="empty">아직 작품집이 없습니다. 아래에서 첫 작품을 올려 보세요.</p>';
  $$('.ib',box).forEach(b=>b.addEventListener('click',()=>workOp(b.dataset.op,+b.dataset.i)));
  if(EDIT) bindEdit(box);
  $('#btnSaveWorks').disabled=!DIRTY; st($('#stWorks'),DIRTY?'게시하지 않은 변경이 있습니다.':'');
}
function workOp(op,i){ const a=app(); const ws=a.works||[]; const w=ws[i];
  if(op==='up'&&i>0){ [ws[i-1],ws[i]]=[ws[i],ws[i-1]]; if(EDIT) EDIT=null; }
  else if(op==='down'&&i<ws.length-1){ [ws[i+1],ws[i]]=[ws[i],ws[i+1]]; if(EDIT) EDIT=null; }
  else if(op==='edit'){ const t=prompt('제목',w.title||''); if(t===null)return; const d=prompt('날짜',w.date||''); if(d===null)return; const b=prompt('한 줄 소개 (비워도 됨)',w.blurb||''); if(b===null)return; const r=prompt('카드 비율 — 3:4(인스타 새 세로) · 4:5 · 1:1 · 9:16',w.ratio||'1:1'); if(r===null)return; w.title=t.trim()||w.title; w.date=d.trim(); w.blurb=b.trim(); if(/^\d+(\.\d+)?:\d+(\.\d+)?$/.test(r.trim())) w.ratio=r.trim(); }
  else if(op==='cards'){ if(EDIT&&EDIT.i===i){ EDIT=null; } else { EDIT={i,list:(w.cards||[]).map(src=>({src,path:src.replace(/^\//,''),gone:false}))}; } renderWorks(); return; }
  else if(op==='del'){ if(!confirm(`「${w.title||w.slug}」을(를) 작품집에서 지울까요? 이미지 파일도 함께 지워집니다.`))return; ws.splice(i,1); DELETED.push({app:SEL,slug:w.slug,cards:w.cards||[]}); if(EDIT) EDIT=null; }
  else return;
  a.works=ws; DIRTY=true; renderWorks();
}
/* ── 작품 안 카드 편집: 순서 · 빼기 · 더하기 ── */
function editHTML(w){
  const ar=ratioAR(w.ratio);
  return `<div class="wedit" style="--ar:${ar}"><div class="cards" id="ecards">${EDIT.list.map((c,j)=>`<div class="cd ${c.gone?'gone':''}" draggable="true" data-j="${j}"><img src="${esc(c.url||c.src)}" alt=""><span class="n ${j===0&&!c.gone?'cover':''} ${c.base64?'new':''}">${String(j+1).padStart(2,'0')}</span><div class="ops"><button type="button" data-op="left" title="앞으로">◀</button><button type="button" data-op="right" title="뒤로">▶</button><button type="button" class="x" data-op="x" title="${c.gone?'되살리기':'빼기'}">${c.gone?'↺':'✕'}</button></div></div>`).join('')}</div>
  <label class="drop" id="edrop"><b>카드 더하기</b><span>끌어다 놓거나 눌러서 고르기 · 뒤에 붙습니다 (자동으로 줄여서 올림)</span><input type="file" id="efiles" accept="image/*" multiple></label>
  <div class="row"><button type="button" class="btn gold" id="btnEditApply">이 작품에 적용</button><button type="button" class="btn line" id="btnEditCancel">취소</button><span class="status" id="stEdit">순서를 바꾸고 <b>적용</b>을 누른 뒤, 위의 <b>변경 사항 게시</b>로 올립니다.</span></div></div>`;
}
function bindEdit(box){
  const grid=$('#ecards',box); if(!grid) return; const L=EDIT.list;
  $$('.cd',grid).forEach(el=>{ const j=+el.dataset.j;
    $$('button',el).forEach(b=>b.addEventListener('click',()=>{ const op=b.dataset.op; if(op==='x'){ if(L[j].base64){ if(L[j].url) URL.revokeObjectURL(L[j].url); L.splice(j,1); } else L[j].gone=!L[j].gone; } else if(op==='left'&&j>0){ [L[j-1],L[j]]=[L[j],L[j-1]]; } else if(op==='right'&&j<L.length-1){ [L[j+1],L[j]]=[L[j],L[j+1]]; } renderWorks(); }));
    el.addEventListener('dragstart',e=>{ e.dataTransfer.setData('text/plain','e'+j); el.classList.add('drag'); });
    el.addEventListener('dragend',()=>el.classList.remove('drag'));
    el.addEventListener('dragover',e=>{ e.preventDefault(); el.classList.add('over'); });
    el.addEventListener('dragleave',()=>el.classList.remove('over'));
    el.addEventListener('drop',e=>{ e.preventDefault(); e.stopPropagation(); el.classList.remove('over'); const d=e.dataTransfer.getData('text/plain'); if(!d.startsWith('e'))return; const from=+d.slice(1); if(isNaN(from)||from===j)return; const [m]=L.splice(from,1); L.splice(j,0,m); renderWorks(); });
  });
  const drop=$('#edrop',box);
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{ e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop',e=>addEditFiles(e.dataTransfer.files));
  $('#efiles',box).addEventListener('change',e=>{ addEditFiles(e.target.files); e.target.value=''; });
  $('#btnEditApply',box).addEventListener('click',applyEdit);
  $('#btnEditCancel',box).addEventListener('click',()=>{ EDIT.list.forEach(c=>{ if(c.url) URL.revokeObjectURL(c.url); }); EDIT=null; renderWorks(); });
}
async function addEditFiles(list){
  const arr=[...list].filter(f=>/^image\//.test(f.type)); arr.sort((a,b)=>a.name.localeCompare(b.name,'ko',{numeric:true})); if(!arr.length) return;
  st($('#stEdit'),`${arr.length}장 줄이는 중…`);
  for(const f of arr){ const r=await shrink(f); EDIT.list.push({src:'',base64:r.base64,ext:r.ext,url:URL.createObjectURL(f),gone:false}); }
  renderWorks();
}
function applyEdit(){
  const a=app(); const w=a.works[EDIT.i]; if(!w) { EDIT=null; renderWorks(); return; }
  const keep=EDIT.list.filter(c=>!c.gone); if(!keep.length){ st($('#stEdit'),'카드가 하나는 있어야 해요.','err'); return; }
  // 새 카드 번호: 기존 파일 번호(뺀 것 포함) 다음부터 — 같은 커밋에서 지우는 파일과 이름이 겹치지 않게
  let n=0; for(const c of (w.cards||[])){ const m=/(\d+)\.[a-z]+$/i.exec(c); if(m) n=Math.max(n,+m[1]); } for(const x of ADDS){ if(x.path.startsWith(`media/${a.slug}/works/${w.slug}/`)){ const m=/(\d+)\.[a-z]+$/i.exec(x.path); if(m) n=Math.max(n,+m[1]); } }
  const cards=[];
  for(const c of keep){ if(c.base64){ n++; const path=`media/${a.slug}/works/${w.slug}/${String(n).padStart(2,'0')}.${c.ext}`; ADDS.push({path,base64:c.base64}); cards.push('/'+path); if(c.url) URL.revokeObjectURL(c.url); } else cards.push(c.src); }
  for(const c of EDIT.list){ if(c.gone&&c.path&&c.path.startsWith('media/')) DELFILES.push(c.path); }
  w.cards=cards; EDIT=null; DIRTY=true; renderWorks();
}
$('#btnSaveWorks').addEventListener('click',async()=>{
  const btn=$('#btnSaveWorks'); btn.disabled=true; st($('#stWorks'),'게시하는 중…');
  try{
    const deletions=[...DELFILES]; for(const d of DELETED){ for(const c of d.cards){ if(c.startsWith('/media/')) deletions.push(c.slice(1)); } }
    const files=ADDS.map(x=>({path:x.path,base64:x.base64})); files.push({path:'data/apps.json',text:JSON.stringify(APPSJSON,null,2)+'\n'});
    await commitFiles(`작품집 정리 (${app().name})`,files,[...new Set(deletions)],(d,n)=>st($('#stWorks'),`카드 올리는 중 ${d}/${n}…`));
    discardWorks(); await readAppsJson(); renderWorks(); st($('#stWorks'),'게시했습니다. 약 1분 뒤 사이트에 반영돼요.','ok');
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
  if(DIRTY){ st($('#stNew'),'작품집에 게시하지 않은 변경이 있어요. 위의 「변경 사항 게시」를 먼저 눌러 주세요.','err'); return; }
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

/* ═══════════════ 앱 소개 글: 한 줄 소개 · 속삭임 · 이야기의 시작 ═══════════════ */
let TSEL='', TORIG=null, TLOADING=false, TNOTE='';
const tApp=()=>APPSJSON.apps.find(a=>a.slug===TSEL);
const storyPath=a=>(a.story?a.story.replace(/^\//,''):`content/${a.slug}.md`);
function buildTextSel(){ const s=$('#tAppSel'); s.innerHTML=APPSJSON.apps.map(a=>`<option value="${esc(a.slug)}">${esc(a.name)}${a.status==='soon'?' (쓰는 중)':''}</option>`).join(''); if(![...s.options].some(o=>o.value===TSEL)) TSEL=SEL||s.options[0]?.value||''; s.value=TSEL; }
function textDirty(){ if(!TORIG) return false; return $('#tSummary').value!==TORIG.summary||$('#tNotice').value!==TORIG.notice||$('#tStory').value!==TORIG.story; }
function textState(){ const d=textDirty(); $('#btnSaveText').disabled=!d||TLOADING; if(!TLOADING) st($('#stText'),d?'고친 내용이 있어요. 저장하고 게시를 누르면 반영됩니다.':TNOTE); }
async function loadText(){
  const a=tApp(); if(!a) return; TLOADING=true; $('#btnSaveText').disabled=true; st($('#stText'),'불러오는 중…');
  $('#tSummary').value=a.summary||''; $('#tNotice').value=a.notice||''; $('#tStory').value='';
  try{ const f=await api('file',{path:storyPath(a)}); $('#tStory').value=f.text||''; TORIG={summary:a.summary||'',notice:a.notice||'',story:f.text||''}; TNOTE=f.missing?'이야기 글은 아직 없어요. 써서 저장하면 새로 만들어집니다.':''; }
  catch(e){ TORIG={summary:a.summary||'',notice:a.notice||'',story:''}; TNOTE='이야기 글을 불러오지 못했습니다: '+e.message; }
  TLOADING=false; textState();
}
$('#tAppSel').addEventListener('change',e=>{ if(textDirty()&&!confirm('저장하지 않은 글이 있어요. 버리고 넘어갈까요?')){ e.target.value=TSEL; return; } TSEL=e.target.value; loadText(); });
['#tSummary','#tNotice','#tStory'].forEach(id=>$(id).addEventListener('input',textState));
$('#btnReloadText').addEventListener('click',()=>{ if(textDirty()&&!confirm('고친 내용을 버리고 저장된 글로 되돌릴까요?')) return; loadText(); });
$('#btnSaveText').addEventListener('click',async()=>{
  if(DIRTY){ st($('#stText'),'작품집에 게시하지 않은 변경이 있어요. 02의 「변경 사항 게시」를 먼저 눌러 주세요.','err'); return; }
  const btn=$('#btnSaveText'); btn.disabled=true; st($('#stText'),'저장하는 중…');
  const summary=$('#tSummary').value.trim(), notice=$('#tNotice').value.trim(), story=$('#tStory').value.replace(/\r/g,'');
  try{
    await readAppsJson(); const a=tApp(); if(!a) throw new Error('앱을 찾지 못했습니다');
    a.summary=summary; a.notice=notice; const sp=storyPath(a); const files=[];
    if(story.trim()){ a.story='/'+sp; files.push({path:sp,text:story.replace(/\s+$/,'')+'\n'}); }
    else if(TORIG&&TORIG.story.trim()){ /* 글을 다 지웠으면 파일은 두고 연결만 끊는다 */ a.story=null; }
    files.push({path:'data/apps.json',text:JSON.stringify(APPSJSON,null,2)+'\n'});
    await commitFiles(`소개 글 수정: ${a.name}`,files,[]);
    TORIG={summary,notice,story}; TNOTE=''; $('#tSummary').value=summary; $('#tNotice').value=notice;
    st($('#stText'),'게시했습니다. 약 1분 뒤 사이트에 반영돼요. (상세 화면을 다시 열면 보입니다)','ok'); buildAppSel(); renderWorks();
  }catch(e){ st($('#stText'),'실패: '+e.message,'err'); btn.disabled=false; }
});

/* ═══════════════ 시작 ═══════════════ */
(function(){ const d=new Date(); $('#wDate').value=`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}`; })();
boot();
})();
