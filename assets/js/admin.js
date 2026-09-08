/* 도구리 작업실 — admin.js
   서버 없이 GitHub API로 저장소에 직접 커밋한다. 토큰은 이 브라우저(localStorage)에만 남는다.
   흐름: 연결 → apps.json 읽기 → 작품 편집/새 작품 → 이미지 축소 → 블롭 업로드 → 트리·커밋 1개 → 브랜치 갱신 → Vercel 자동 배포 → 사이트에서 확인 */
(() => {
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const store={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}},del:k=>{try{localStorage.removeItem(k)}catch(e){}}};
const API='https://api.github.com';
let CFG={owner:'',repo:'',branch:'main',token:''};
let APPSJSON=null, APPS_SHA=null, SEL='card-novel', DIRTY=false;
let NEW=[]; // {id,file,name,url(blob preview)}

/* ═══════════════ GitHub API ═══════════════ */
async function gh(path,opts={}){
  const r=await fetch(API+path,{...opts,headers:{'Authorization':'Bearer '+CFG.token,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(opts.body?{'Content-Type':'application/json'}:{}),...(opts.headers||{})}});
  if(!r.ok){ let m=''; try{ m=(await r.json()).message||''; }catch(e){} throw new Error(`${r.status} ${m||r.statusText}`); }
  return r.status===204?null:r.json();
}
const repoPath=()=>`/repos/${CFG.owner}/${CFG.repo}`;
function b64ToUtf8(b64){ const bin=atob(b64.replace(/\n/g,'')); const bytes=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) bytes[i]=bin.charCodeAt(i); return new TextDecoder().decode(bytes); }
async function readAppsJson(){ const j=await gh(`${repoPath()}/contents/data/apps.json?ref=${encodeURIComponent(CFG.branch)}`); APPS_SHA=j.sha; APPSJSON=JSON.parse(b64ToUtf8(j.content)); }
async function listDir(path){ try{ const j=await gh(`${repoPath()}/contents/${path}?ref=${encodeURIComponent(CFG.branch)}`); return Array.isArray(j)?j:[]; }catch(e){ return []; } }
/* 파일 여러 개 + apps.json 을 커밋 하나로 */
async function commitFiles(message, files /* [{path, base64|text}] */, deletions /* [path] */, onProgress){
  const ref=await gh(`${repoPath()}/git/ref/heads/${encodeURIComponent(CFG.branch)}`); const headSha=ref.object.sha;
  const head=await gh(`${repoPath()}/git/commits/${headSha}`); const baseTree=head.tree.sha;
  const tree=[]; let done=0;
  for(const f of files){ const blob=await gh(`${repoPath()}/git/blobs`,{method:'POST',body:JSON.stringify(f.base64?{content:f.base64,encoding:'base64'}:{content:f.text,encoding:'utf-8'})}); tree.push({path:f.path,mode:'100644',type:'blob',sha:blob.sha}); done++; onProgress&&onProgress(done,files.length,f.path); }
  for(const p of (deletions||[])) tree.push({path:p,mode:'100644',type:'blob',sha:null});
  const newTree=await gh(`${repoPath()}/git/trees`,{method:'POST',body:JSON.stringify({base_tree:baseTree,tree})});
  const commit=await gh(`${repoPath()}/git/commits`,{method:'POST',body:JSON.stringify({message,tree:newTree.sha,parents:[headSha]})});
  await gh(`${repoPath()}/git/refs/heads/${encodeURIComponent(CFG.branch)}`,{method:'PATCH',body:JSON.stringify({sha:commit.sha,force:false})});
  return commit.sha;
}

/* ═══════════════ 연결 ═══════════════ */
const st=(el,msg,cls)=>{ el.textContent=msg; el.className='status'+(cls?' '+cls:''); };
function loadCfg(){ try{ const c=JSON.parse(store.get('dgr-admin')||'{}'); if(c.owner) $('#owner').value=c.owner; if(c.repo) $('#repo').value=c.repo; if(c.branch) $('#branch').value=c.branch; if(c.token) $('#token').value=c.token; }catch(e){} }
async function connect(){
  CFG={owner:$('#owner').value.trim(),repo:$('#repo').value.trim(),branch:$('#branch').value.trim()||'main',token:$('#token').value.trim()};
  if(!CFG.owner||!CFG.repo||!CFG.token){ st($('#stConnect'),'아이디·저장소·토큰을 모두 적어 주세요.','err'); return; }
  st($('#stConnect'),'확인하는 중…');
  try{
    const r=await gh(repoPath()); await readAppsJson();
    store.set('dgr-admin',JSON.stringify(CFG));
    st($('#stConnect'),`연결됨 · ${r.full_name} (${r.private?'비공개':'공개'}) · 앱 ${APPSJSON.apps.length}개`,'ok');
    $('#pWorks').hidden=false; $('#pNew').hidden=false; buildAppSel(); renderWorks();
  }catch(e){ st($('#stConnect'),'연결 실패: '+e.message+(/401|403/.test(e.message)?' — 토큰 권한(Contents: Read and write)과 저장소 선택을 확인해 주세요.':/404/.test(e.message)?' — 아이디·저장소 이름을 확인해 주세요.':''),'err'); }
}
$('#btnConnect').addEventListener('click',connect);
$('#token').addEventListener('keydown',e=>{ if(e.key==='Enter') connect(); });
$('#btnForget').addEventListener('click',()=>{ store.del('dgr-admin'); $('#token').value=''; st($('#stConnect'),'이 브라우저에서 토큰을 지웠습니다.'); $('#pWorks').hidden=true; $('#pNew').hidden=true; });

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
    const sha=await commitFiles(`작품 추가: ${title} (${a.name})`,files,[],(d,n,p)=>{ fill.style.width=(32+60*d/n)+'%'; });
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
loadCfg();
(function(){ const d=new Date(); $('#wDate').value=`${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}`; })();
if($('#token').value) connect();
})();
