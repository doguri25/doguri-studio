/* 도구리 작업실 — site.js
   구조: data/apps.json 을 읽어 서가(카드)를 그리고, /project/<slug> · /about 주소를 오버레이로 연다.
   빌드 없음. 이 파일과 site.css, index.html 세 개가 전부다. */
(() => {
'use strict';

/* ═══════════════ 유틸 ═══════════════ */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
/* 움직임: 기본은 켜짐. OS의 "움직임 줄이기"(윈도우 애니메이션 효과 끄기 등)는 그대로 따르지 않고 안내만 하며, 헤더의 ✦ 버튼으로 끄고 켠다(localStorage dgr-motion) */
const osReduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const motionPref=(()=>{ try{ return localStorage.getItem('dgr-motion'); }catch(e){ return null; } })();
const reduced=motionPref==='off';
document.documentElement.classList.toggle('reduce',reduced);
const fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
const toast=(msg)=>{const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),2600);};
const store={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const SITE_NAME='도구리 작업실';
/* 빌드 스탬프: index.html이 이 파일을 site.js?v=… 로 불렀다면 그 값을 apps.json 요청에도 붙인다(tools/stamp.py) */
const BUILD=(()=>{ try{ const src=(document.currentScript&&document.currentScript.src)||''; const m=/[?&]v=([0-9a-z]+)/i.exec(src); return m?m[1]:''; }catch(e){ return ''; } })();
let SITE={}, APPS=[];

/* 복사·드래그 선택 방지 (공개 페이지만): 링크 드래그·이미지 저장 메뉴는 두고, 글자 복사와 선택만 막는다 */
['copy','cut','selectstart'].forEach(ev=>document.addEventListener(ev,e=>{ if(!document.body.classList.contains('site')) return; const t=e.target; if(t&&(t.closest&&t.closest('input,textarea'))) return; e.preventDefault(); }));
addEventListener('keydown',e=>{ if(!document.body.classList.contains('site')) return; if((e.ctrlKey||e.metaKey)&&(e.key==='a'||e.key==='A')&&!(e.target&&e.target.closest&&e.target.closest('input,textarea'))) e.preventDefault(); });

/* ═══════════════ 인트로: 처음 온 사람에게만 ═══════════════ */
const intro=$('#intro');
function finishIntro(){ if(!intro||intro._done)return; intro._done=true; intro.classList.add('open'); setTimeout(()=>{intro.remove();document.body.classList.add('go');revealCards();},1250); store.set('dgr-intro-seen','1'); }
if(reduced||store.get('dgr-intro-seen')){ intro.remove(); document.body.classList.add('go'); }
else{ intro.addEventListener('click',finishIntro); setTimeout(finishIntro,1500); }

/* ═══════════════ 제목 글자 분리 ═══════════════ */
(function(){const h=$('#title');let i=0;const walk=n=>{[...n.childNodes].forEach(c=>{if(c.nodeType===3){const f=document.createDocumentFragment();[...c.textContent].forEach(ch=>{const s=document.createElement('span');s.className='lt'+(ch===' '?' sp':'');s.textContent=ch===' '?' ':ch;s.style.setProperty('--i',i++);f.appendChild(s)});n.replaceChild(f,c)}else walk(c)})};walk(h);})();

/* ═══════════════ 촛불 · 커서 · 속삭임 ═══════════════ */
const root=document.documentElement, whispers=$('#whispers'), cursor=$('.cursor');
let px=innerWidth/2, py=innerHeight*.38, cx=px, cy=py, found=new Set();
/* 포인터 처리는 프레임당 한 번(rAF)으로 묶는다 — pointermove마다 레이아웃을 읽고 스타일을 쓰면 PC에서 끊긴다 */
let ptrDirty=false, whisperEls=null, whisperBoxes=null, whisperBoxT=0;
function movePointer(x,y){ px=x;py=y; if(!ptrDirty){ ptrDirty=true; requestAnimationFrame(applyPointer); } }
function applyPointer(){ ptrDirty=false; const x=px,y=py; root.style.setProperty('--x',x+'px'); root.style.setProperty('--y',y+'px');
  const now=performance.now(); if(!whisperEls||now-whisperBoxT>600){ whisperEls=$$('.whisper'); const wr=whispers.getBoundingClientRect(); whisperBoxes={wr,list:whisperEls.map(c=>c.getBoundingClientRect())}; whisperBoxT=now; }
  const r=whisperBoxes.wr; whispers.style.setProperty('--cx',(x-r.left)+'px'); whispers.style.setProperty('--cy',(y-r.top)+'px');
  whisperEls.forEach((c,i)=>{ if(found.has(i))return; const b=whisperBoxes.list[i]; const dx=b.left+b.width/2-x, dy=b.top+b.height/2-y; if(Math.hypot(dx,dy)<130){ found.add(i); $('#whisperN').textContent=found.size; const bd=$('#whisperBadge'); bd.classList.remove('bump'); void bd.offsetWidth; bd.classList.add('bump'); if(found.size===3) toast('속삭임을 모두 들었습니다. 이제 서랍을 열어도 됩니다.'); } }); }
addEventListener('pointermove',e=>movePointer(e.clientX,e.clientY),{passive:true});
addEventListener('touchmove',e=>{const t=e.touches[0];if(t)movePointer(t.clientX,t.clientY)},{passive:true});
addEventListener('touchstart',e=>{const t=e.touches[0];if(t)movePointer(t.clientX,t.clientY)},{passive:true});
if(fine&&!reduced){ (function loop(){ cx+=(px-cx)*.18; cy+=(py-cy)*.18; cursor.style.transform=`translate(${cx}px,${cy}px) translate(-50%,-50%)`; requestAnimationFrame(loop); })();
  document.addEventListener('pointerover',e=>{ cursor.classList.toggle('hot',!!e.target.closest('a,button,.file,.chip,.shot,.card3d')); }); }

/* ═══════════════ 반딧불 · 먼지 ═══════════════ */
(function(){ if(reduced)return; const c=$('#dust'),ctx=c.getContext('2d'); let W,H,P=[]; const N=90;
  const DPR=1; /* 먼지는 작은 점이라 고해상도가 필요 없다 — 4K·레티나에서 픽셀 4배를 아낀다 */
  /* 폰에서 스크롤로 주소창이 접히고 펴질 때 innerHeight가 바뀌며 resize가 오는데, 그때마다 캔버스를 다시 만들면 점들이 순간이동한다.
     캔버스는 처음부터 '가장 큰 화면 높이'로 잡고, 폭이 바뀌거나 높이가 더 커질 때만 다시 만든다(그때도 점 위치는 비율로 유지). */
  const bigH=()=>Math.max(innerHeight,document.documentElement.clientHeight,(screen&&screen.height)||0);
  const size=()=>{ const w=innerWidth, h=bigH(); if(W===w*DPR&&H>=h*DPR) return; W=c.width=w*DPR;H=c.height=h*DPR;c.style.width=w+'px';c.style.height=h+'px'; };
  size(); let rzT=null; addEventListener('resize',()=>{ clearTimeout(rzT); rzT=setTimeout(size,120); });
  for(let i=0;i<N;i++)P.push({x:Math.random(),y:Math.random(),r:.5+Math.random()*1.4,a:.15+Math.random()*.45,s:.00005+Math.random()*.00012,t:Math.random()*6.28,k:Math.random()<.18});
  /* 오버레이가 덮여 있거나(body.lock) 탭이 안 보이면 그리지 않는다. 좌표는 CSS픽셀(DPR=1)이라 변환이 없다 */
  let odd=false;
  (function frame(){ if(document.body.classList.contains('lock')||document.hidden){ setTimeout(frame,250); return; }
    odd=!odd; if(odd){ requestAnimationFrame(frame); return; } /* 30fps면 충분 — 헤더 블러 등 위 레이어의 재합성 부담을 반으로 */
    ctx.clearRect(0,0,W,H); for(const p of P){ p.y-=p.s; p.t+=.004; p.x+=Math.sin(p.t)*.00008; if(p.y<-.02){p.y=1.02;p.x=Math.random()} const gx=p.x*W,gy=p.y*H; const d=Math.hypot(gx-px,gy-py); const glow=Math.max(0,1-d/380); const tw=p.k?(.6+.4*Math.sin(p.t*9)):1; ctx.beginPath(); ctx.arc(gx,gy,p.r*(1+glow*.8)*(p.k?1.6:1),0,6.28); ctx.fillStyle=p.k?`rgba(239,208,141,${p.a*tw*(0.5+glow*.8)})`:`rgba(217,221,233,${p.a*(0.3+glow*.9)})`; ctx.fill(); } requestAnimationFrame(frame); })();
})();

/* ═══════════════ 헤더 · 패럴랙스 ═══════════════ */
/* compact 전환에 히스테리시스(내려갈 땐 64px, 올라올 땐 16px) — 경계에서 왔다 갔다 하지 않게 */
addEventListener('scroll',()=>{ whisperBoxT=0; const t=$('#top'); if(scrollY>64) t.classList.add('compact'); else if(scrollY<16) t.classList.remove('compact'); $('.moon').style.setProperty('--sy',scrollY); },{passive:true});

/* ═══════════════ 그림·썸네일 ═══════════════ */
function artHTML(kind){ return `<div class="art ${kind||'soon-art'}">${kind==='cards'?'<i></i><i></i><i></i>':kind==='sun'?'<i></i><i></i>':'<i></i>'}</div>`; }
/* 스크린샷이 있으면 사진, 없으면 벡터 그림 */
function visHTML(app,src){ const s=src||app.thumb; return `<div class="vis">${artHTML(app.art)}${s?`<img src="${esc(s)}" alt="${esc(app.name)} 화면" loading="lazy">`:''}</div>`; }

/* ═══════════════ 서가 렌더 ═══════════════ */
const grid=$('#grid'), chipsEl=$('#chips'); let tag='all';
const rots=[-1.6,1.1,-0.8,1.4,-1.2,0.9];
function renderCards(){
  grid.innerHTML=APPS.map((a,i)=>`
  <article class="file ${a.status==='soon'?'soon':''}" data-slug="${esc(a.slug)}" data-tags="${esc(a.tags.join('|'))}" data-private="${a.private?1:0}" style="--rot:${rots[i%rots.length]}deg;--vt:file-${esc(a.slug)}" tabindex="0" role="button" aria-label="${esc(a.name)} 열어 보기"><div class="inner">
    <i class="seal" aria-hidden="true">D</i>
    <span class="tab">${a.status==='soon'?'UNWRITTEN':(a.private?'PRIVATE · ':'SEALED · ')+esc(a.num)}</span>
    <div class="photo"><i class="tape l"></i><i class="tape r"></i>${visHTML(a)}<div class="lens" aria-hidden="true">${visHTML(a)}</div></div>
    <div class="meta"><h3><span class="num">${esc(a.num)}</span>${esc(a.name)}</h3><p>${esc(a.summary)}</p><div class="tags">${a.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div></div>
    <div class="acts">${a.cardButton==='works'&&validWorks(a).length?`<a class="btn gold run" href="/project/${esc(a.slug)}/works" role="button">작품 보기</a>`:runLink(a,'실행','run')}<button type="button" class="btn line dl" ${canDl(a)||a.private?'':'disabled'} ${a.downloads&&a.downloads.length&&a.allowDownload===false?'title="지금은 내려받을 수 없어요"':''}>다운로드</button></div>
    <span class="stamp" aria-hidden="true">${a.status==='soon'?'아직 봉인 중':a.private?'비공개 · 열람만':'봉인을 뜯어 보세요'}</span>
  </div></article>`).join('');
  $$('.file',grid).forEach(bindCard);
}
function renderChips(){
  const all=[...new Set(APPS.flatMap(a=>a.tags))].filter(t=>t!=='준비 중');
  const cnt=t=>APPS.filter(a=>a.tags.includes(t)).length;
  chipsEl.innerHTML=[`<button type="button" class="chip on" data-tag="all" role="tab">전체<span class="n">${APPS.length}</span></button>`,...all.map(t=>`<button type="button" class="chip" data-tag="${esc(t)}" role="tab">${esc(t)}<span class="n">${cnt(t)}</span></button>`)].join('');
  $$('.chip',chipsEl).forEach(c=>c.addEventListener('click',()=>setFilter(c.dataset.tag)));
}
function updateCount(){ const vis=$$('.file',grid).filter(c=>!c.hidden); const soon=vis.filter(c=>c.classList.contains('soon')).length; const priv=vis.filter(c=>c.dataset.private==='1'&&!c.classList.contains('soon')).length; const live=vis.length-soon-priv; $('#count').innerHTML=`서가의 봉인 <b>${vis.length}</b>통 · 열 수 있는 이야기 <b>${live}</b>편${priv?` · 비공개 <b>${priv}</b>편`:''} · 쓰는 중 <b>${soon}</b>편`; }
function setFilter(t,silent){
  if(!$$('.chip',chipsEl).some(c=>c.dataset.tag===t)) t='all';
  tag=t; $$('.chip',chipsEl).forEach(c=>c.classList.toggle('on',c.dataset.tag===t));
  const apply=()=>{ $$('.file',grid).forEach(c=>{ c.hidden=!(t==='all'||c.dataset.tags.split('|').includes(t)); }); updateCount(); drawThread(false); };
  if(document.startViewTransition&&!reduced&&!silent){ document.startViewTransition(apply); } else apply();
  if(!silent&&!current&&about.hidden) history.replaceState(history.state,'',t==='all'?'/':'/#tag='+encodeURIComponent(t));
}

/* 봉인 사이를 잇는 별자리 */
function drawThread(animate){
  const svg=$('#thread'), wrap=$('#boardWrap'), wr=wrap.getBoundingClientRect();
  const pts=$$('.file',grid).filter(c=>!c.hidden).map(c=>{const r=$('.seal',c).getBoundingClientRect();return {x:r.left+r.width/2-wr.left,y:r.top+r.height/2-wr.top}});
  svg.setAttribute('viewBox',`0 0 ${wr.width} ${wr.height}`); svg.setAttribute('width',wr.width); svg.setAttribute('height',wr.height);
  let d=''; for(let i=0;i<pts.length-1;i++){ const a=pts[i],b=pts[i+1]; const dist=Math.hypot(b.x-a.x,b.y-a.y); const sag=Math.min(60,dist*.14); const mx=(a.x+b.x)/2, my=(a.y+b.y)/2-sag; d+=`${i?'':'M'+a.x+' '+a.y} Q ${mx} ${my} ${b.x} ${b.y} `; }
  svg.innerHTML=(d?`<path d="${d}" class="${animate&&!reduced?'draw':''}"></path>`:'')+pts.map((p,i)=>`<circle cx="${p.x}" cy="${p.y}" r="2.6" class="${i%2?'tw':''}" style="animation-delay:${i*.7}s"></circle>`).join('');
  const path=$('path',svg); if(path&&animate&&!reduced){ const len=path.getTotalLength(); path.style.setProperty('--len',len); }
}
let rt; addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>drawThread(false),120)});

/* 카드 등장 */
let revealed=false;
function revealCards(){
  if(revealed||!APPS.length)return; revealed=true;
  const cards=$$('.file',grid); const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.remove('pre');e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.15});
  cards.forEach((c,i)=>{ if(c.getBoundingClientRect().top>innerHeight){c.classList.add('pre');io.observe(c)} else { c.style.animationDelay=(i*90)+'ms'; c.classList.add('in'); } });
  setTimeout(()=>{ cards.forEach(c=>{ if(c.classList.contains('pre')){ c.classList.remove('pre'); c.classList.add('in'); } }); drawThread(false); },3500);
  grid.addEventListener('animationend',e=>{ if(e.target.classList&&e.target.classList.contains('file')) drawThread(false); });
  drawThread(true);
}

/* 카드 인터랙션 */
function bindCard(card){
  const app=APPS.find(a=>a.slug===card.dataset.slug); const photo=$('.photo',card), lens=$('.lens',card), lensVis=$('.vis',lens);
  if(fine&&!reduced){
    card.addEventListener('pointerenter',()=>{ card._r=card.getBoundingClientRect(); });
    card.addEventListener('pointermove',e=>{ if(card.classList.contains('soon'))return; const r=card._r||card.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width, y=(e.clientY-r.top)/r.height;
      card.style.setProperty('--rx',((y-.5)*-7).toFixed(2)+'deg'); card.style.setProperty('--ry',((x-.5)*9).toFixed(2)+'deg'); card.classList.add('tilt'); });
    card.addEventListener('pointerleave',()=>{ card.style.setProperty('--rx','0deg'); card.style.setProperty('--ry','0deg'); card.classList.remove('tilt'); photo.classList.remove('zoom'); });
    photo.addEventListener('pointerenter',()=>{ if(card.classList.contains('soon')) return; photo.classList.add('zoom'); const r=photo.getBoundingClientRect(); lensVis.style.width=r.width+'px'; lensVis.style.height=r.height+'px'; photo._r=r; });
    photo.addEventListener('pointerleave',()=>photo.classList.remove('zoom'));
    photo.addEventListener('pointermove',e=>{ const r=photo._r||photo.getBoundingClientRect(); const lx=e.clientX-r.left, ly=e.clientY-r.top; const Z=2.1; photo.style.setProperty('--lx',lx+'px'); photo.style.setProperty('--ly',ly+'px');
      lensVis.style.transform=`translate(${55-lx*Z}px,${55-ly*Z}px) scale(${Z})`; });
  }
  $('.run',card).addEventListener('click',e=>{ e.stopPropagation(); ripple(e); if(app.cardButton==='works'&&validWorks(app).length){ e.preventDefault(); const r=e.currentTarget.getBoundingClientRect(); slam('WORKS',r.left+r.width/2,r.top-10); openGallery(app.slug); return; } runApp(app,e); });
  $('.run',card).addEventListener('keydown',e=>e.stopPropagation()); // Enter가 카드 열기로 새지 않게
  $('.dl',card).addEventListener('click',e=>{ e.stopPropagation(); ripple(e); app.private?privateNotice(e):downloadApp(app,e); });
  card.addEventListener('click',()=>{ if(!card.classList.contains('soon')) openCase(app.slug,card); else toast('아직 봉인이 마르지 않았습니다.'); });
  card.addEventListener('keydown',e=>{ if((e.key==='Enter'||e.key===' ')&&!card.classList.contains('soon')){e.preventDefault();openCase(app.slug,card);} });
}
function ripple(e){ const b=e.currentTarget; const r=b.getBoundingClientRect(); const s=document.createElement('span'); s.className='ripple'; const d=Math.max(r.width,r.height); s.style.cssText=`width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px`; b.appendChild(s); setTimeout(()=>s.remove(),650); }
function slam(text,x,y){ if(reduced)return; const s=document.createElement('span'); s.className='slam'; s.textContent=text; s.style.left=x+'px'; s.style.top=y+'px'; document.body.appendChild(s); setTimeout(()=>s.remove(),1000); }
function privateNotice(e){ const r=e.currentTarget.getBoundingClientRect(); slam('PRIVATE',r.left+r.width/2,r.top-10); toast('비공개입니다 — 아직 서가 밖으로 나가지 않은 이야기예요.'); }
/* 실행 버튼은 진짜 링크(<a target=_blank>)다. window.open을 늦게 부르면 팝업 차단기에 막히는 브라우저가 있어서,
   도장 효과만 얹고 새 탭은 브라우저가 링크 그대로 열게 둔다. */
/* 공개 설정: allowRun / allowDownload 가 false면 버튼을 비활성(관리 화면 04에서 켜고 끈다) */
const canRun=app=>!!(app.run&&app.run.url)&&app.allowRun!==false;
const canDl=app=>!!(app.downloads&&app.downloads.length)&&app.allowDownload!==false;
function runLink(app,label,cls=''){ const ok=canRun(app); const priv=!!app.private;
  return `<a class="btn gold ${cls}" href="${ok?esc(app.run.url):'#'}" ${ok&&!priv?'target="_blank" rel="noopener"':''} ${!(ok||priv)?'aria-disabled="true" tabindex="-1"':''} role="button">${label}</a>`; }
function runApp(app,e){ /* 링크의 기본 동작(새 탭)은 막지 않고 도장만 찍는다 */
  if(app.private){ e.preventDefault(); privateNotice(e); return; }
  if(!app||!canRun(app)){ e.preventDefault(); return; }
  const r=e.currentTarget.getBoundingClientRect(); slam('OPEN',r.left+r.width/2,r.top-10); }
function downloadApp(app,e){ if(!app||!canDl(app))return; const r=e.currentTarget.getBoundingClientRect();
  const idx=e.currentTarget.dataset.i!==undefined?+e.currentTarget.dataset.i:0; const f=app.downloads[idx]||app.downloads[0]; if(!f||!f.file){ toast('아직 파일이 연결되지 않았습니다.'); return; }
  slam('SAVE',r.left+r.width/2,r.top-10); const a=document.createElement('a'); a.href=f.file; if(/^https?:/.test(f.file)&&!f.file.startsWith(location.origin)){ a.target='_blank'; a.rel='noopener'; } else a.download=f.filename||''; document.body.appendChild(a); a.click(); a.remove(); }

/* ═══════════════ 마크다운 (제목·문단·목록·인용·굵게·기울임·링크·이미지) ═══════════════ */
function md(src){
  const inline=s=>esc(s).replace(/!\[([^\]]*)\]\(([^)]+)\)/g,'<img alt="$1" src="$2" loading="lazy">').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\*(.+?)\*/g,'<i>$1</i>').replace(/`(.+?)`/g,'<code>$1</code>');
  const lines=src.replace(/\r/g,'').split('\n'); const out=[]; let para=[], list=null;
  const flushP=()=>{ if(para.length){out.push('<p>'+inline(para.join(' '))+'</p>');para=[]} };
  const flushL=()=>{ if(list){out.push('<ul>'+list.map(l=>'<li>'+inline(l)+'</li>').join('')+'</ul>');list=null} };
  for(const raw of lines){ const l=raw.trim();
    if(!l){flushP();flushL();continue}
    const h=l.match(/^(#{1,3})\s+(.*)/); if(h){flushP();flushL();const lv=h[1].length+2;out.push(`<h${lv}>${inline(h[2])}</h${lv}>`);continue}
    const li=l.match(/^[-*]\s+(.*)/); if(li){flushP();(list=list||[]).push(li[1]);continue}
    if(l.startsWith('>')){flushP();flushL();out.push('<blockquote>'+inline(l.replace(/^>\s?/,''))+'</blockquote>');continue}
    flushL(); para.push(l); }
  flushP(); flushL(); return out.join('');
}
const storyCache={};
async function loadStory(app){ if(!app.story) return ''; if(storyCache[app.slug]) return storyCache[app.slug];
  try{ const r=await fetch(app.story); if(!r.ok) throw 0; const t=await r.text(); return storyCache[app.slug]=md(t); }catch(e){ return '<p class="loading err">이야기 파일을 아직 찾지 못했습니다 · '+esc(app.story)+'</p>'; } }

/* ═══════════════ 이야기 펼치기 (상세) ═══════════════ */
const dossier=$('#dossier'); let current=null, currentCard=null, pushed=false;
function feedbackURL(app){ if(!SITE.feedbackForm) return '#'; const u=new URL(SITE.feedbackForm); if(app&&SITE.feedbackField){ u.searchParams.set('usp','pp_url'); u.searchParams.set(SITE.feedbackField,app.name); } return u.toString(); }
function fillDossier(app){
  $('#dNum').textContent='No. '+app.num+(app.period?' · '+app.period:''); $('#dTitle').textContent=app.name; $('#dLead').textContent=app.summary;
  $('#dPhoto').innerHTML=visHTML(app);
  const acts=$('#dActs');
  if(app.private){ acts.innerHTML=`${runLink(app,'실행')}<button type="button" class="btn line">다운로드</button>`; $('.gold',acts).onclick=e=>{ripple(e);runApp(app,e)}; $$('.line',acts).forEach(b=>b.onclick=e=>{ripple(e);privateNotice(e)}); }
  else { const dls=canDl(app)?(app.downloads||[]):[];
    /* cardButton:"works"(카드소설 제작소)는 상세에서도 「작품 보기」가 주 버튼. 도구 자체는 그 옆 선 버튼으로 연다 */
    const primary=app.cardButton==='works'&&validWorks(app).length?`<a class="btn gold works-btn" href="/project/${esc(app.slug)}/works" role="button">작품 보기 · ${validWorks(app).length}편</a>${canRun(app)?`<a class="btn line" href="${esc(app.run.url)}" target="_blank" rel="noopener">${esc(app.name)} 열기 · 새 탭</a>`:''}`:runLink(app,app.run&&app.allowRun===false?'실행 · 지금은 닫혀 있어요':'실행 · 새 탭에서 열기');
    acts.innerHTML=`${primary}${dls.map((d,i)=>`<button type="button" class="btn line" data-i="${i}">↓ ${esc(d.label)}${d.size?` <small>(${esc(d.size)})</small>`:''}</button>`).join('')}${app.downloads&&app.downloads.length&&app.allowDownload===false?'<span class="alt">다운로드는 지금 닫혀 있어요.</span>':''}`;
  const wb=$('.works-btn',acts); if(wb){ wb.onclick=e=>{ e.preventDefault(); ripple(e); const r=e.currentTarget.getBoundingClientRect(); slam('WORKS',r.left+r.width/2,r.top-10); openGallery(app.slug); }; } else $('.gold',acts).onclick=e=>{ripple(e);runApp(app,e)};
  $$('button.line',acts).forEach(b=>b.onclick=e=>{ripple(e);downloadApp(app,e)}); $$('a.line',acts).forEach(b=>b.onclick=e=>{ripple(e); const r=e.currentTarget.getBoundingClientRect(); slam('OPEN',r.left+r.width/2,r.top-10);}); }
  $('#dAlt').innerHTML=app.altRun?`다른 버전: <a href="${esc(app.altRun.url)}" target="_blank" rel="noopener">${esc(app.altRun.label)}</a>`:'';
  $('#dAlt').hidden=!app.altRun;
  const n=$('#dNotice'); n.hidden=!app.notice; $('span',n).textContent=app.notice||'';
  $('#dFacts').innerHTML=(app.facts||[]).map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  $('#dFacts').hidden=!(app.facts&&app.facts.length);
  const shots=(app.screens&&app.screens.length)?app.screens.map((s,i)=>`<div class="shot" tabindex="0" data-src="${esc(s)}">${visHTML(app,s)}<span>장면 ${i+1}</span></div>`):[1,2,3].map(i=>`<div class="shot" tabindex="0">${visHTML(app)}<span>장면 ${i} · 스크린샷 준비 중</span></div>`);
  $('#dGal').innerHTML=(app.video?`<div class="shot video"><video src="${esc(app.video)}" controls playsinline preload="metadata"></video></div>`:'')+shots.join('');
  $$('.shot:not(.video)',$('#dGal')).forEach(s=>{ s.addEventListener('click',()=>openLb(s.dataset.src?`<img src="${esc(s.dataset.src)}" alt="">`:s.innerHTML)); s.addEventListener('keydown',e=>{ if(e.key==='Enter') s.click(); }); });
  renderWorks(app);
  $('#dStory').innerHTML='<p class="loading">봉인을 뜯는 중…</p>'; loadStory(app).then(h=>{ if(current&&current.slug===app.slug) $('#dStory').innerHTML=h; });
  $('#dFb').href=feedbackURL(app);
  document.title=app.name+' · '+SITE_NAME;
}
function cardOf(slug){ return $(`.file[data-slug="${CSS.escape(slug)}"]`,grid); }
function openCase(slug,card,push=true){
  const app=APPS.find(a=>a.slug===slug&&a.status!=='soon'); if(!app||current)return; current=app; currentCard=card||cardOf(slug); fillDossier(app);
  dossier.hidden=false; dossier.scrollTop=0; document.body.classList.add('lock'); requestAnimationFrame(()=>dossier.classList.add('on'));
  if(push){ history.pushState({view:'project',slug},'','/project/'+encodeURIComponent(slug)); pushed=true; } else pushed=false;
  const to=$('#dPhoto').getBoundingClientRect(); card=currentCard;
  if(card&&!reduced&&!card.hidden&&card.getBoundingClientRect().height>0){ const from=$('.photo',card).getBoundingClientRect(); const g=document.createElement('div'); g.className='ghost'; g.innerHTML=visHTML(app);
    g.style.cssText=`left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px`; document.body.appendChild(g);
    const anim=g.animate([{transform:'translate(0,0) scale(1,1)'},{transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(${to.width/from.width},${to.height/from.height})`}],{duration:560,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});
    anim.onfinish=()=>{ dossier.classList.add('ready'); g.remove(); };
  } else dossier.classList.add('ready');
  $('#dBack').focus({preventScroll:true});
}
function closeCase(viaHistory=false){
  if(!current)return; if(!viewer.hidden) closeViewer(); const app=current, card=currentCard; current=null; document.title=SITE_NAME;
  if(!viaHistory){ if(pushed) history.back(); else history.replaceState(null,'','/'); }
  pushed=false;
  if(card&&!reduced&&!card.hidden){ const from=$('#dPhoto').getBoundingClientRect(); const to=$('.photo',card).getBoundingClientRect(); const g=document.createElement('div'); g.className='ghost'; g.innerHTML=visHTML(app);
    g.style.cssText=`left:${from.left}px;top:${from.top}px;width:${from.width}px;height:${from.height}px`; document.body.appendChild(g); dossier.classList.remove('ready');
    g.animate([{transform:'translate(0,0) scale(1,1)'},{transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(${to.width/from.width},${to.height/from.height})`,opacity:.6}],{duration:460,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'}).onfinish=()=>g.remove(); }
  dossier.classList.remove('on'); setTimeout(()=>{ dossier.hidden=true; dossier.classList.remove('ready'); if(gallery.hidden&&viewer.hidden) document.body.classList.remove('lock'); if(card) card.focus({preventScroll:true}); },420);
}
function step(dir){ const live=APPS.filter(a=>a.status!=='soon'); const i=live.findIndex(a=>a.slug===current.slug); const n=live[(i+dir+live.length)%live.length]; if(!n||n===current)return;
  dossier.classList.remove('ready'); current=null; setTimeout(()=>{ history.replaceState({view:'project',slug:n.slug},'','/project/'+encodeURIComponent(n.slug)); current=n; currentCard=cardOf(n.slug); fillDossier(n); dossier.scrollTo({top:0,behavior:reduced?'auto':'smooth'}); requestAnimationFrame(()=>dossier.classList.add('ready')); },60); }
$('#dBack').addEventListener('click',()=>closeCase());
dossier.addEventListener('click',e=>{ if(e.target===dossier) closeCase(); });
$('#dPrev').addEventListener('click',()=>step(-1)); $('#dNext').addEventListener('click',()=>step(1));

/* ═══════════════ 작품집 (카드 묶음) 과 카드 뷰어 ═══════════════ */
function ratioWH(r){ const m=String(r||'1:1').split(':'); return {w:parseFloat(m[0])||1,h:parseFloat(m[1])||1}; }
const WORKS_PREVIEW=4; // 상세에는 최근 넷만, 나머지는 「작품 모두 보기」(갤러리)
const validWorks=app=>(app.works||[]).filter(w=>w&&w.cards&&w.cards.length);
function workTile(w,i){ const r=ratioWH(w.ratio); return `<button type="button" class="work" data-i="${i}" style="--ar:${r.w}/${r.h}" aria-label="${esc(w.title)} 열어 보기"><div class="cover"><img src="${esc(w.cards[0])}" alt="" loading="lazy"><i></i></div><div class="cap"><b>${esc(w.title)}</b><span>${w.cards.length}장${w.date?' · '+esc(w.date):''}</span></div>${w.blurb?`<p class="blurb">${esc(w.blurb)}</p>`:''}</button>`; }
function renderWorks(app){
  const sec=$('#dWorksSec'), box=$('#dWorks'); const works=validWorks(app);
  sec.hidden=!works.length; if(!works.length){ box.innerHTML=''; return; }
  const shown=works.slice(0,WORKS_PREVIEW), rest=works.length-shown.length; const ar=ratioWH((shown[0]||{}).ratio);
  $('#dWorksN').textContent=works.length+'편'; const all=$('#dWorksAll'); all.hidden=!rest; all.onclick=()=>openGallery(app.slug);
  box.innerHTML=shown.map(workTile).join('')+(rest?`<button type="button" class="work more" style="--ar:${ar.w}/${ar.h}" aria-label="작품 ${rest}편 더 보기"><div class="cover"><div><b>+${rest}</b><span>작품 모두 보기</span></div></div><div class="cap"><b>더보기</b><span>${works.length}편 전부</span></div></button>`:'');
  $$('.work:not(.more)',box).forEach(el=>el.addEventListener('click',()=>openViewer(works[+el.dataset.i])));
  const more=$('.work.more',box); if(more) more.addEventListener('click',()=>openGallery(app.slug));
}
/* ── 작품집 전체 (갤러리 오버레이) — /project/<slug>/works ── */
const gallery=$('#gallery'); let galleryApp=null, galleryPushed=false;
function openGallery(slug,push=true){
  const app=APPS.find(a=>a.slug===slug); const works=app?validWorks(app):[]; if(!app||!works.length) return;
  galleryApp=app; $('#gTitle').textContent=app.name+' · 작품집'; $('#gCount').textContent=String(works.length).padStart(2,'0')+' WORKS';
  $('#gLead').textContent=works.length+'편의 작품이 있어요. 표지를 누르면 한 장씩 넘겨 읽을 수 있고, 최근 작품이 앞에 옵니다.';
  $('#gWorks').innerHTML=works.map(workTile).join(''); $$('.work',$('#gWorks')).forEach(el=>el.addEventListener('click',()=>openViewer(works[+el.dataset.i])));
  $('#gFoot').innerHTML=(canRun(app)&&!app.private?`<a class="btn line" href="${esc(app.run.url)}" target="_blank" rel="noopener">${esc(app.name)} 열기 · 새 탭</a>`:'')+`<button type="button" class="btn line" id="gToStory">이 도구의 이야기 읽기</button><span>표지는 첫 장 · 뷰어에서 ← → 키나 옆으로 밀어서 넘기기</span>`;
  $('#gToStory').onclick=()=>{ closeGallery(); if(!current||current.slug!==app.slug){ setTimeout(()=>openCase(app.slug,cardOf(app.slug)),80); } };
  if(gallery.hidden){ gallery.hidden=false; gallery.scrollTop=0; document.body.classList.add('lock'); requestAnimationFrame(()=>{ gallery.classList.add('on'); setTimeout(()=>gallery.classList.add('ready'),80); }); }
  if(push){ history.pushState({view:'works',slug},'','/project/'+encodeURIComponent(slug)+'/works'); galleryPushed=true; } else galleryPushed=false;
  document.title=app.name+' 작품집 · '+SITE_NAME; $('#gBack').focus({preventScroll:true});
}
function closeGallery(viaHistory=false){
  if(gallery.hidden) return; if(!viewer.hidden) closeViewer(); const app=galleryApp; galleryApp=null;
  gallery.classList.remove('on'); setTimeout(()=>{ gallery.hidden=true; gallery.classList.remove('ready'); if(dossier.hidden&&about.hidden&&viewer.hidden) document.body.classList.remove('lock'); },400);
  if(!viaHistory){ if(galleryPushed) history.back(); else history.replaceState(null,'',current?'/project/'+encodeURIComponent(current.slug):'/'); }
  galleryPushed=false; document.title=current?current.name+' · '+SITE_NAME:SITE_NAME;
}
$('#gBack').addEventListener('click',()=>closeGallery()); gallery.addEventListener('click',e=>{ if(e.target===gallery) closeGallery(); });
const viewer=$('#viewer'), vStage=$('#vStage'); let V=null, vHintT=null;
function cardEl(src,cls){ const d=document.createElement('div'); d.className='v-card '+cls; d.innerHTML=`<img src="${esc(src)}" alt="" draggable="false">`; return d; }
function preloadCards(from){ for(let k=from;k<Math.min(from+3,V.work.cards.length);k++){ const im=new Image(); im.src=V.work.cards[k]; } }
/* 카드 묶음(stage)은 next2 → next → cur 순서로 놓인다. 넘길 때 요소를 새로 만들지 않고 클래스만 승격시켜(next→cur) CSS transition으로 미끄러지게 한다 — 새로 만들면 다음 장이 한 번 "자리잡는" 점프가 보인다 */
function buildStack(first){ vStage.innerHTML=''; const c=V.work.cards; for(let k=2;k>=0;k--){ const idx=V.i+k; if(idx<c.length) vStage.appendChild(cardEl(c[idx], k===0?('cur'+(first?' first':'')):k===1?'next':'next2')); } vUpdate(); preloadCards(V.i+1); }
function promoteForward(){ /* V.i는 이미 +1 된 상태. 현재 cur를 돌려주고 next→cur, next2→next, 새 next2 추가 */
  const out=$('.v-card.cur',vStage), nx=$('.v-card.next',vStage), nx2=$('.v-card.next2',vStage);
  if(nx){ nx.classList.remove('next'); nx.classList.add('cur'); } if(nx2){ nx2.classList.remove('next2'); nx2.classList.add('next'); }
  const idx2=V.i+2; if(idx2<V.work.cards.length){ vStage.insertBefore(cardEl(V.work.cards[idx2],'next2'),vStage.firstChild); }
  vUpdate(); preloadCards(V.i+1); return out; }
function demoteBackward(incoming){ /* V.i는 이미 -1 된 상태. incoming(왼쪽에서 온 카드)이 cur가 되고 cur→next, next→next2, 옛 next2 제거 */
  const cur=$('.v-card.cur',vStage), nx=$('.v-card.next',vStage), nx2=$('.v-card.next2',vStage);
  if(nx2) nx2.remove(); if(nx){ nx.classList.remove('next'); nx.classList.add('next2'); } if(cur){ cur.classList.remove('cur','drag','snap','fling'); cur.classList.add('next'); cur.style.cssText=''; }
  incoming.classList.remove('prev','drag'); incoming.classList.add('cur','fling'); incoming.style.transform=''; incoming.style.opacity='';
  setTimeout(()=>incoming.classList.remove('fling'),320); vUpdate(); preloadCards(V.i+1); }
function vUpdate(){ const n=V.work.cards.length; $('#vCnt').textContent=String(V.i+1).padStart(2,'0')+' / '+String(n).padStart(2,'0');
  $('#vPrev').disabled=V.i===0; $('#vNext').disabled=false;
  const dots=$('#vDots'); if(n<=24){ dots.innerHTML=V.work.cards.map((_,k)=>`<i class="${k===V.i?'on':k<V.i?'seen':''}"></i>`).join(''); } else dots.innerHTML=''; }
function openViewer(work){ if(!work||!work.cards||!work.cards.length)return; V={work,i:0,busy:false}; const r=ratioWH(work.ratio); viewer.style.setProperty('--w',r.w); viewer.style.setProperty('--h',r.h);
  $('#vTitle').textContent=work.title||''; $('#vSub').textContent=[work.date,work.blurb].filter(Boolean).join(' · '); $('#vEndTitle').textContent=work.title||''; $('#vEnd').hidden=true; $('#vHint').classList.remove('off');
  viewer.hidden=false; buildStack(true); requestAnimationFrame(()=>viewer.classList.add('on')); document.body.classList.add('lock');
  clearTimeout(vHintT); vHintT=setTimeout(()=>$('#vHint').classList.add('off'),3500); $('#vNext').focus({preventScroll:true}); }
function closeViewer(){ if(viewer.hidden)return; viewer.classList.remove('on'); setTimeout(()=>{ viewer.hidden=true; vStage.innerHTML=''; V=null; if(dossier.hidden&&about.hidden&&gallery.hidden) document.body.classList.remove('lock'); },350); }
function vStep(dir){ if(!V||V.busy)return; const n=V.i+dir, len=V.work.cards.length; if(n<0)return; if(!$('#vEnd').hidden){ if(dir<0){ $('#vEnd').hidden=true; } else return; }
  if(n>=len){ $('#vEnd').hidden=false; return; }
  V.busy=true; $('#vHint').classList.add('off');
  if(dir>0){ V.i=n; const out=promoteForward(); if(out){ out.classList.remove('cur'); out.classList.add('out'); setTimeout(()=>out.remove(),460); } }
  else { V.i=n; const p=cardEl(V.work.cards[n],'prev'); p.style.transform='translateY(-50%) translateX(-115%) rotate(-8deg)'; p.style.opacity='0'; vStage.appendChild(p); void p.offsetWidth; demoteBackward(p); }
  setTimeout(()=>{ V.busy=false; },reduced?0:400); }
$('#vNext').addEventListener('click',()=>vStep(1)); $('#vPrev').addEventListener('click',()=>vStep(-1));
$('#vX').addEventListener('click',closeViewer); $('#vClose2').addEventListener('click',closeViewer);
$('#vAgain').addEventListener('click',()=>{ if(!V)return; $('#vEnd').hidden=true; V.i=0; buildStack(true); });
/* 탭·스와이프 — 카드가 손가락을 따라오고, 놓으면 넘어가거나 제자리로 돌아온다 */
(function(){ let sx=0, sy=0, t0=0, id=null, dragging=false, dx=0, prevEl=null, moved=false;
  const cur=()=>$('.v-card.cur',vStage);
  const prevCard=()=>{ if(!V||V.i===0) return null; const el=cardEl(V.work.cards[V.i-1],'prev'); el.style.transform='translateY(-50%) translateX(-115%) rotate(-8deg)'; vStage.appendChild(el); return el; };
  vStage.addEventListener('pointerdown',e=>{ if(!V||V.busy||!$('#vEnd').hidden) return; sx=e.clientX; sy=e.clientY; t0=Date.now(); id=e.pointerId; dragging=true; moved=false; dx=0; try{ vStage.setPointerCapture(id); }catch(x){} const c=cur(); if(c){ c.classList.add('drag'); } });
  vStage.addEventListener('pointermove',e=>{ if(!dragging||e.pointerId!==id) return; dx=e.clientX-sx; const dy=e.clientY-sy; if(!moved&&Math.abs(dx)<6&&Math.abs(dy)<6) return; moved=true; const c=cur(); if(!c) return;
    if(dx<0){ if(prevEl){ prevEl.remove(); prevEl=null; } c.style.transform=`translateY(-50%) translateX(${dx}px) rotate(${(dx*0.035).toFixed(2)}deg)`; c.style.opacity=String(Math.max(.35,1+dx/900)); }
    else { c.style.transform='translateY(-50%)'; c.style.opacity='1'; if(V.i>0){ if(!prevEl) prevEl=prevCard(); const k=Math.min(1,dx/260); prevEl.style.transform=`translateY(-50%) translateX(${-115+115*k}%) rotate(${-8+8*k}deg)`; } else { c.style.transform=`translateY(-50%) translateX(${Math.min(60,dx*.25)}px)`; } } });
  const release=e=>{ if(!dragging||(e&&e.pointerId!==id)) return; dragging=false; const c=cur(); const dt=Date.now()-t0; const vx=Math.abs(dx)/Math.max(1,dt);
    const w=vStage.getBoundingClientRect().width; const go=Math.abs(dx)>Math.min(90,w*.22)||(Math.abs(dx)>30&&vx>.45);
    if(!moved){ if(c){ c.classList.remove('drag'); c.style.transform=''; c.style.opacity=''; } if(prevEl){ prevEl.remove(); prevEl=null; }
      if(dt<400&&e){ const r=vStage.getBoundingClientRect(); vStep((e.clientX-r.left)<r.width*.4?-1:1); } return; }
    if(go&&dx<0){ /* 다음: 현재 카드를 밀어낸 방향으로 날려 보낸다 */ V.busy=true; c.classList.remove('drag'); c.classList.add('fling'); c.style.transform=`translateY(-50%) translateX(${-w*1.1}px) rotate(-14deg)`; c.style.opacity='0';
      setTimeout(()=>{ const n=V.i+1; if(n>=V.work.cards.length){ $('#vEnd').hidden=false; c.style.cssText=''; c.classList.remove('fling'); } else { V.i=n; const out=promoteForward(); if(out) out.remove(); } V.busy=false; },260); }
    else if(go&&dx>0&&prevEl){ /* 이전: 왼쪽에서 오던 카드가 그대로 cur가 된다 */ V.busy=true; const pe=prevEl; prevEl=null; V.i=V.i-1; demoteBackward(pe); setTimeout(()=>{ V.busy=false; },300); }
    else { /* 제자리로 */ if(c){ c.classList.remove('drag'); c.classList.add('snap'); c.style.transform=''; c.style.opacity=''; setTimeout(()=>c.classList.remove('snap'),320); } if(prevEl){ const pe=prevEl; prevEl=null; pe.classList.add('fling'); pe.style.transform='translateY(-50%) translateX(-115%) rotate(-8deg)'; setTimeout(()=>pe.remove(),300); } }
    $('#vHint').classList.add('off'); };
  vStage.addEventListener('pointerup',release); vStage.addEventListener('pointercancel',release); vStage.addEventListener('lostpointercapture',()=>{ if(dragging) release(null); });
})();
$('#vEnd').addEventListener('click',e=>{ if(e.target===$('#vEnd')) closeViewer(); });

/* 라이트박스 */
const lb=$('#lb'); function openLb(html){ $('#lbFrame').innerHTML=html; lb.hidden=false; requestAnimationFrame(()=>lb.classList.add('on')); }
function closeLb(){ lb.classList.remove('on'); setTimeout(()=>lb.hidden=true,300); }
$('#lbX').addEventListener('click',closeLb); lb.addEventListener('click',e=>{ if(e.target===lb) closeLb(); });

/* ═══════════════ 소개 ═══════════════ */
const about=$('#about'); let aboutPushed=false;
function openAbout(push=true){ if(!about.hidden)return; if(current) closeCase(); about.hidden=false; document.body.classList.add('lock'); requestAnimationFrame(()=>{about.classList.add('on');setTimeout(()=>about.classList.add('ready'),120)});
  if(push){ history.pushState({view:'about'},'','/about'); aboutPushed=true; } else aboutPushed=false; document.title='소개 · '+SITE_NAME; }
function closeAbout(viaHistory=false){ if(about.hidden)return; about.classList.remove('on'); setTimeout(()=>{about.hidden=true;about.classList.remove('ready');document.body.classList.remove('lock');},400);
  if(!viaHistory){ if(aboutPushed) history.back(); else history.replaceState(null,'','/'); } aboutPushed=false; document.title=SITE_NAME; }
$('#aboutBtn').addEventListener('click',e=>{e.preventDefault();openAbout();}); $('#aClose').addEventListener('click',()=>closeAbout());
about.addEventListener('click',e=>{ if(e.target===about) closeAbout(); });
$('#aGo').addEventListener('click',()=>{ closeAbout(); });
$('#nameCard').addEventListener('click',()=>$('#nameCard').classList.toggle('flip'));
const fbClick=e=>{ if(!SITE.feedbackForm){ e.preventDefault(); toast('편지함(의견 폼)은 아직 준비 중입니다.'); } };
$('#aFb').addEventListener('click',fbClick); $('#fbLink').addEventListener('click',fbClick); $('#dFb').addEventListener('click',fbClick);
$('#fxBtn').addEventListener('click',()=>{ store.set('dgr-motion',reduced?'on':'off'); toast(reduced?'효과를 켭니다…':'효과를 끕니다…'); setTimeout(()=>location.reload(),350); });
$('#fxBtn').title=reduced?'화면 효과 켜기':'화면 효과 끄기'; $('#fxBtn span').textContent=reduced?'효과 꺼짐':'효과';
if(osReduced&&motionPref===null&&!store.get('dgr-motion-hint')){ store.set('dgr-motion-hint','1'); setTimeout(()=>toast('기기에 「움직임 줄이기」가 켜져 있어요. 어지러우면 위의 ✦ 효과 버튼으로 끌 수 있습니다.'),3200); }
$('#brand').addEventListener('click',e=>{ e.preventDefault(); if(current) closeCase(); if(!about.hidden) closeAbout(); scrollTo({top:0,behavior:reduced?'auto':'smooth'}); });
addEventListener('keydown',e=>{
  if(!viewer.hidden){ if(e.key==='Escape') closeViewer(); else if(e.key==='ArrowRight'||e.key===' '||e.key==='Enter'&&e.target===vStage){ e.preventDefault(); vStep(1); } else if(e.key==='ArrowLeft'){ e.preventDefault(); vStep(-1); } return; }
  if(e.key==='Escape'){ if(!lb.hidden) closeLb(); else if(!gallery.hidden) closeGallery(); else if(current) closeCase(); else if(!about.hidden) closeAbout(); } });

/* ═══════════════ 주소 → 화면 ═══════════════ */
function parseLocation(){ const q=new URLSearchParams(location.search); let w=location.pathname.match(/^\/project\/([^/]+)\/works\/?$/); if(w) return {view:'works',slug:decodeURIComponent(w[1])};
  let m=location.pathname.match(/^\/project\/([^/]+)\/?$/);
  if(m) return {view:'project',slug:decodeURIComponent(m[1])}; if(q.get('id')) return {view:'project',slug:q.get('id')};
  if(/^\/about\/?$/.test(location.pathname)) return {view:'about'}; return {view:'home'}; }
function parseTag(){ const h=location.hash.match(/^#tag=(.+)$/); if(h) return decodeURIComponent(h[1]); const q=new URLSearchParams(location.search); return q.get('tag')||'all'; }
addEventListener('popstate',()=>{ if(!viewer.hidden) closeViewer(); const l=parseLocation();
  if(l.view==='works'){ if(!about.hidden) closeAbout(true); if(gallery.hidden||!galleryApp||galleryApp.slug!==l.slug) openGallery(l.slug,false); return; }
  if(!gallery.hidden) closeGallery(true);
  if(l.view==='project'){ if(current&&current.slug===l.slug)return; if(current){ current=null; dossier.classList.remove('ready'); fillDossierSwap(l.slug); return; } if(!about.hidden) closeAbout(true); openCase(l.slug,cardOf(l.slug),false); }
  else if(l.view==='about'){ if(current) closeCase(true); openAbout(false); }
  else { if(current) closeCase(true); if(!about.hidden) closeAbout(true); } });
function fillDossierSwap(slug){ const n=APPS.find(a=>a.slug===slug&&a.status!=='soon'); if(!n){ closeCase(true); return; } setTimeout(()=>{ current=n; currentCard=cardOf(slug); fillDossier(n); dossier.scrollTo({top:0}); requestAnimationFrame(()=>dossier.classList.add('ready')); },60); }

/* ═══════════════ 시작: 데이터 읽기 ═══════════════ */
/* ═══════════════ 속삭임: 올 때마다 다른 세 문장 ═══════════════
   기본 문장 묶음 + 지금 서가 상태로 만드는 문장(작품 수·장 수·비공개 편수 등) + apps.json site.whispers(있으면)에서 3개를 뽑는다.
   직전 방문에 나온 문장은 피한다(localStorage dgr-whisper-last). 자리는 세 칸에 살짝 흔들림을 준다. */
const WHISPERS=[
  '이 페이지는 밤에만 열립니다','세 번째 서랍은 아직 열지 마세요','누군가 먼저 다녀간 흔적이 있습니다','촛불이 흔들리면 문장이 바뀝니다',
  '봉인은 뜯는 사람의 것입니다','달이 기울면 서가가 한 칸 늘어납니다','읽지 않은 편지가 아직 따뜻합니다','모든 이야기는 첫 장이 가장 조용합니다',
  '여기서 본 것은 여기 두고 가세요','잉크가 마르기 전에 돌아오세요','문은 안쪽에서만 잠깁니다','진실은 회차마다 자리를 바꿉니다',
  '우산 하나가 젖지 않은 이유를 아십니까','카드는 한 장씩만 넘기세요','주파수를 맞추면 누군가 대답합니다','공을 잡는 순간 기(氣)가 오릅니다',
  '중앙선을 넘은 공은 죽은 공이 됩니다','사진은 어디에도 남지 않습니다','약속은 인쇄되어야 지켜집니다','아침 일곱 시, 책상이 스스로 정리됩니다',
  '새 봉인은 늘 맨 뒤에서 마릅니다','서가는 최근 것을 앞에 둡니다','밤의 서가에는 시계가 없습니다','이 속삭임은 다음에 오면 없습니다',
  '안개는 서가 쪽으로 흘러갑니다','열쇠는 브라우저에 두지 않습니다','두 번째 달은 렌즈 안에만 뜹니다','봉인 번호는 순서가 아니라 이름입니다',
  '문 뒤의 이야기는 문이 열릴 때까지 자랍니다','속삭임을 셋 모으면 서랍이 열립니다',
  /* 밤에 어울리는 문장들 */
  '밤은 모든 소리를 조금 더 멀리 보냅니다','잠들지 못한 사람에게만 보이는 문장입니다','창문 너머의 불빛도 누군가의 밤입니다','달빛은 오래 걸어온 사람을 먼저 비춥니다',
  '오늘 못 한 말은 내일 아침에도 남아 있어요','별은 세다가 멈춘 자리에서 다시 셉니다','밤공기는 낮에 못 한 생각을 데려옵니다','이 시간의 커피는 조금 더 조용합니다',
  '잠깐 멈춘 시계도 밤에는 정확합니다','새벽 세 시의 글자는 아침에 다시 읽으세요','불을 끄면 비로소 보이는 것들이 있습니다','밤은 길지 않아요, 다만 천천히 갑니다',
  '오늘의 마지막 페이지를 접어 두었습니다','누군가의 밤에도 같은 달이 떠 있습니다','조용한 밤에는 마음의 글씨가 커집니다','가로등 하나가 골목의 밤을 다 지킵니다',
  '밤에 쓴 편지는 부치지 말고 두세요','잠들기 전의 생각은 모두 진심입니다','창가의 빗소리는 오래된 자장가입니다','어둠은 눈이 아니라 마음으로 익숙해집니다',
  '밤하늘은 아무도 다 읽지 못한 책입니다','오늘 하루도 무사히 여기까지 왔습니다','이불 속의 온기는 작은 우주입니다','늦은 밤의 발자국은 조용히 지워집니다',
  '달은 매일 조금씩 다른 얼굴로 옵니다','잠든 도시 위로 이야기들이 날아갑니다','밤이 깊을수록 별은 가까워집니다','오늘의 걱정은 내일의 나에게 맡기세요',
  '촛불 하나면 밤도 방이 됩니다','좋은 밤이 되길, 아무도 모르게 빌었습니다'
];
function dynamicWhispers(){
  const out=[]; const live=APPS.filter(a=>a.status!=='soon'); const priv=live.filter(a=>a.private).length;
  const works=[]; live.forEach(a=>(a.works||[]).forEach(w=>{ if(w&&w.cards&&w.cards.length) works.push({...w,app:a}); }));
  if(live.length) out.push(`서가에 봉인이 ${live.length}통, 그중 ${priv}통은 비공개입니다`);
  if(works.length){ const w=works[Math.floor(Math.random()*works.length)]; out.push(`「${w.title}」은 ${w.cards.length}장 뒤에 끝납니다`); if(works.length>1) out.push(`카드소설 ${works.length}편이 서가에 꽂혀 있습니다`); }
  const newest=live.filter(a=>!a.pin).sort((a,b)=>(Date.parse(b.added||'')||0)-(Date.parse(a.added||'')||0))[0]; if(newest) out.push(`가장 최근에 봉인된 것은 「${newest.name}」입니다`);
  return out;
}
function renderWhispers(){
  const box=$('#whispers'); if(!box) return;
  let last=[]; try{ last=JSON.parse(store.get('dgr-whisper-last')||'[]'); }catch(e){}
  let pool=[...WHISPERS,...dynamicWhispers(),...((SITE.whispers||[]).filter(x=>typeof x==='string'&&x.trim()))];
  const fresh=pool.filter(t=>!last.includes(t)); if(fresh.length>=3) pool=fresh;
  const pick=[]; while(pick.length<3&&pool.length){ const i=Math.floor(Math.random()*pool.length); pick.push(pool.splice(i,1)[0]); }
  const mobile=innerWidth<=560; /* 폰: 글자와 안 겹치는 빈 자리(왼쪽 위·버튼 옆·맨 아래), PC: 오른쪽 절반 */
  const slots=mobile?[{l:4,t:1},{l:50,t:71},{l:28,t:90}]:[{l:48,t:5},{l:56,t:48},{l:52,t:82}]; const j=()=> ((Math.random()*8-4)*(mobile?.4:1)).toFixed(1);
  box.innerHTML=pick.map((t,i)=>{ const s=slots[i]; return `<span class="whisper" style="left:${(s.l+ +j()).toFixed(1)}%;top:${(s.t+ +j()/2).toFixed(1)}%;--r:${(Math.random()*4-2).toFixed(1)}deg">${esc(t)}</span>`; }).join('');
  store.set('dgr-whisper-last',JSON.stringify(pick)); whisperEls=null; whisperBoxT=0;
}
/* 서가 순서: pin(1,2,…)이 있는 앱이 그 번호 순으로 먼저, 나머지는 added(올린 날짜) 최신순, '쓰는 중'은 맨 뒤.
   apps.json 배열 순서와 무관하게 여기서 정한다 — 관리 화면 「서가 순서」에서 pin을 바꾼다. */
function shelfOrder(list){
  const t=a=>Date.parse(a.added||'')||0;
  return list.map((a,i)=>({a,i})).sort((x,y)=>{
    const A=x.a,B=y.a; const sa=A.status==='soon'?1:0, sb=B.status==='soon'?1:0; if(sa!==sb) return sa-sb;
    const pa=A.pin?1:0, pb=B.pin?1:0; if(pa!==pb) return pb-pa;
    if(pa&&pb&&A.pin!==B.pin) return A.pin-B.pin;
    const d=t(B)-t(A); if(d) return d; return x.i-y.i;
  }).map(x=>x.a);
}
async function boot(){
  try{
    const q=BUILD?'?v='+BUILD:'';
    const [r,ro]=await Promise.all([fetch('/data/apps.json'+q,{cache:'no-cache'}),fetch('/data/overrides.json'+q,{cache:'no-cache'}).catch(()=>null)]); if(!r.ok) throw new Error(r.status);
    const data=await r.json(); let ov={}; try{ if(ro&&ro.ok){ const oj=await ro.json(); ov=(oj&&oj.apps)||{}; } }catch(e){}
    /* data/overrides.json(관리 화면이 쓰는 파일)이 apps.json(코드와 함께 배포되는 기본값) 위에 덮인다 — 새 버전을 올려도 올린 작품·고친 글이 남는 이유 */
    const OVK=['works','summary','notice','story','pin','allowRun','allowDownload','private'];
    SITE=data.site||{}; APPS=shelfOrder((data.apps||[]).map(a=>{ const o=ov[a.slug]; if(!o||typeof o!=='object') return a; const m={...a}; for(const k of OVK) if(k in o) m[k]=o[k]; return m; }));
  }catch(e){
    grid.innerHTML='<div class="loading err">앱 목록(data/apps.json)을 읽지 못했습니다.<br>파일을 직접 열면(file://) 읽을 수 없어요 — 저장소 폴더에서 <code>npx serve -s .</code> 로 띄운 뒤 열어 주세요.</div>';
    return;
  }
  if(!(window.CSS&&CSS.supports&&CSS.supports('scrollbar-gutter','stable'))){ const sbw=innerWidth-document.documentElement.clientWidth; if(sbw>0) document.documentElement.style.setProperty('--sbw',sbw+'px'); }
  renderWhispers(); renderCards(); renderChips(); updateCount();
  setFilter(parseTag(),true);
  if(document.body.classList.contains('go')) revealCards();
  const l=parseLocation();
  const delay=document.body.classList.contains('go')?0:2600;
  if(l.view==='project') setTimeout(()=>openCase(l.slug,cardOf(l.slug),false),delay);
  else if(l.view==='works') setTimeout(()=>{ openCase(l.slug,cardOf(l.slug),false); openGallery(l.slug,false); },delay); /* 딥링크: 상세를 밑에 깔고 갤러리를 연다 */
  else if(l.view==='about') setTimeout(()=>openAbout(false),delay);
  if(document.fonts) document.fonts.ready.then(()=>drawThread(false));
}
boot();
})();
