/* 도구리 작업실 — site.js
   구조: data/apps.json 을 읽어 서가(카드)를 그리고, /project/<slug> · /about 주소를 오버레이로 연다.
   빌드 없음. 이 파일과 site.css, index.html 세 개가 전부다. */
(() => {
'use strict';

/* ═══════════════ 유틸 ═══════════════ */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine=matchMedia('(hover:hover) and (pointer:fine)').matches;
const toast=(msg)=>{const t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('on'),2600);};
const store={get:k=>{try{return localStorage.getItem(k)}catch(e){return null}},set:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const SITE_NAME='도구리 작업실';
let SITE={}, APPS=[];

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
function movePointer(x,y){ px=x;py=y; root.style.setProperty('--x',x+'px'); root.style.setProperty('--y',y+'px');
  const r=whispers.getBoundingClientRect(); whispers.style.setProperty('--cx',(x-r.left)+'px'); whispers.style.setProperty('--cy',(y-r.top)+'px');
  $$('.whisper').forEach((c,i)=>{ if(found.has(i))return; const b=c.getBoundingClientRect(); const dx=b.left+b.width/2-x, dy=b.top+b.height/2-y; if(Math.hypot(dx,dy)<130){ found.add(i); $('#whisperN').textContent=found.size; const bd=$('#whisperBadge'); bd.classList.remove('bump'); void bd.offsetWidth; bd.classList.add('bump'); if(found.size===3) toast('속삭임을 모두 들었습니다. 이제 서랍을 열어도 됩니다.'); } }); }
addEventListener('pointermove',e=>movePointer(e.clientX,e.clientY),{passive:true});
addEventListener('touchmove',e=>{const t=e.touches[0];if(t)movePointer(t.clientX,t.clientY)},{passive:true});
addEventListener('touchstart',e=>{const t=e.touches[0];if(t)movePointer(t.clientX,t.clientY)},{passive:true});
if(fine&&!reduced){ (function loop(){ cx+=(px-cx)*.18; cy+=(py-cy)*.18; cursor.style.transform=`translate(${cx}px,${cy}px) translate(-50%,-50%)`; requestAnimationFrame(loop); })();
  document.addEventListener('pointerover',e=>{ cursor.classList.toggle('hot',!!e.target.closest('a,button,.file,.chip,.shot,.card3d')); }); }

/* ═══════════════ 반딧불 · 먼지 ═══════════════ */
(function(){ if(reduced)return; const c=$('#dust'),ctx=c.getContext('2d'); let W,H,P=[]; const N=70;
  const size=()=>{W=c.width=innerWidth*devicePixelRatio;H=c.height=innerHeight*devicePixelRatio;c.style.width=innerWidth+'px';c.style.height=innerHeight+'px'};
  size(); addEventListener('resize',size);
  for(let i=0;i<N;i++)P.push({x:Math.random(),y:Math.random(),r:.5+Math.random()*1.4,a:.15+Math.random()*.45,s:.00005+Math.random()*.00012,t:Math.random()*6.28,k:Math.random()<.18});
  (function frame(){ ctx.clearRect(0,0,W,H); for(const p of P){ p.y-=p.s; p.t+=.004; p.x+=Math.sin(p.t)*.00008; if(p.y<-.02){p.y=1.02;p.x=Math.random()} const gx=p.x*W,gy=p.y*H; const d=Math.hypot(gx/devicePixelRatio-px,gy/devicePixelRatio-py); const glow=Math.max(0,1-d/380); const tw=p.k?(.6+.4*Math.sin(p.t*9)):1; ctx.beginPath(); ctx.arc(gx,gy,p.r*devicePixelRatio*(1+glow*.8)*(p.k?1.6:1),0,6.28); ctx.fillStyle=p.k?`rgba(239,208,141,${p.a*tw*(0.5+glow*.8)})`:`rgba(217,221,233,${p.a*(0.3+glow*.9)})`; ctx.fill(); } requestAnimationFrame(frame); })();
})();

/* ═══════════════ 헤더 · 패럴랙스 ═══════════════ */
addEventListener('scroll',()=>{ $('#top').classList.toggle('compact',scrollY>40); $('.moon').style.setProperty('--sy',scrollY); },{passive:true});

/* ═══════════════ 그림·썸네일 ═══════════════ */
function artHTML(kind){ return `<div class="art ${kind||'soon-art'}">${kind==='cards'?'<i></i><i></i><i></i>':kind==='sun'?'<i></i><i></i>':'<i></i>'}</div>`; }
/* 스크린샷이 있으면 사진, 없으면 벡터 그림 */
function visHTML(app,src){ const s=src||app.thumb; return `<div class="vis">${artHTML(app.art)}${s?`<img src="${esc(s)}" alt="${esc(app.name)} 화면" loading="lazy">`:''}</div>`; }

/* ═══════════════ 서가 렌더 ═══════════════ */
const grid=$('#grid'), chipsEl=$('#chips'); let tag='all';
const rots=[-1.6,1.1,-0.8,1.4,-1.2,0.9];
function renderCards(){
  grid.innerHTML=APPS.map((a,i)=>`
  <article class="file ${a.status==='soon'?'soon':''}" data-slug="${esc(a.slug)}" data-tags="${esc(a.tags.join('|'))}" style="--rot:${rots[i%rots.length]}deg;--vt:file-${esc(a.slug)}" tabindex="0" role="button" aria-label="${esc(a.name)} 열어 보기"><div class="inner">
    <i class="seal" aria-hidden="true">D</i>
    <span class="tab">${a.status==='soon'?'UNWRITTEN':'SEALED · '+esc(a.num)}</span>
    <div class="photo"><i class="tape l"></i><i class="tape r"></i>${visHTML(a)}<div class="lens" aria-hidden="true">${visHTML(a)}</div></div>
    <div class="meta"><h3><span class="num">${esc(a.num)}</span>${esc(a.name)}</h3><p>${esc(a.summary)}</p><div class="tags">${a.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div></div>
    <div class="acts"><button type="button" class="btn gold run" ${a.run?'':'disabled'}>실행</button><button type="button" class="btn line dl" ${a.downloads&&a.downloads.length?'':'disabled'}>다운로드</button></div>
    <span class="stamp" aria-hidden="true">${a.status==='soon'?'아직 봉인 중':'봉인을 뜯어 보세요'}</span>
  </div></article>`).join('');
  $$('.file',grid).forEach(bindCard);
}
function renderChips(){
  const all=[...new Set(APPS.flatMap(a=>a.tags))].filter(t=>t!=='준비 중');
  const cnt=t=>APPS.filter(a=>a.tags.includes(t)).length;
  chipsEl.innerHTML=[`<button type="button" class="chip on" data-tag="all" role="tab">전체<span class="n">${APPS.length}</span></button>`,...all.map(t=>`<button type="button" class="chip" data-tag="${esc(t)}" role="tab">${esc(t)}<span class="n">${cnt(t)}</span></button>`)].join('');
  $$('.chip',chipsEl).forEach(c=>c.addEventListener('click',()=>setFilter(c.dataset.tag)));
}
function updateCount(){ const vis=$$('.file',grid).filter(c=>!c.hidden); const live=vis.filter(c=>!c.classList.contains('soon')).length; $('#count').innerHTML=`서가의 봉인 <b>${vis.length}</b>통 · 열 수 있는 이야기 <b>${live}</b>편 · 쓰는 중 <b>${vis.length-live}</b>편`; }
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
    card.addEventListener('pointermove',e=>{ if(card.classList.contains('soon'))return; const r=card.getBoundingClientRect(); const x=(e.clientX-r.left)/r.width, y=(e.clientY-r.top)/r.height;
      card.style.setProperty('--rx',((y-.5)*-7).toFixed(2)+'deg'); card.style.setProperty('--ry',((x-.5)*9).toFixed(2)+'deg'); card.classList.add('tilt'); });
    card.addEventListener('pointerleave',()=>{ card.style.setProperty('--rx','0deg'); card.style.setProperty('--ry','0deg'); card.classList.remove('tilt'); photo.classList.remove('zoom'); });
    photo.addEventListener('pointerenter',()=>{ if(!card.classList.contains('soon')) photo.classList.add('zoom'); });
    photo.addEventListener('pointerleave',()=>photo.classList.remove('zoom'));
    photo.addEventListener('pointermove',e=>{ const r=photo.getBoundingClientRect(); const lx=e.clientX-r.left, ly=e.clientY-r.top; const Z=2.1; photo.style.setProperty('--lx',lx+'px'); photo.style.setProperty('--ly',ly+'px');
      lensVis.style.width=r.width+'px'; lensVis.style.height=r.height+'px'; lensVis.style.transform=`translate(${55-lx*Z}px,${55-ly*Z}px) scale(${Z})`; });
  }
  $('.run',card).addEventListener('click',e=>{ e.stopPropagation(); ripple(e); runApp(app,e); });
  $('.dl',card).addEventListener('click',e=>{ e.stopPropagation(); ripple(e); downloadApp(app,e); });
  card.addEventListener('click',()=>{ if(!card.classList.contains('soon')) openCase(app.slug,card); else toast('아직 봉인이 마르지 않았습니다.'); });
  card.addEventListener('keydown',e=>{ if((e.key==='Enter'||e.key===' ')&&!card.classList.contains('soon')){e.preventDefault();openCase(app.slug,card);} });
}
function ripple(e){ const b=e.currentTarget; const r=b.getBoundingClientRect(); const s=document.createElement('span'); s.className='ripple'; const d=Math.max(r.width,r.height); s.style.cssText=`width:${d}px;height:${d}px;left:${e.clientX-r.left-d/2}px;top:${e.clientY-r.top-d/2}px`; b.appendChild(s); setTimeout(()=>s.remove(),650); }
function slam(text,x,y){ if(reduced)return; const s=document.createElement('span'); s.className='slam'; s.textContent=text; s.style.left=x+'px'; s.style.top=y+'px'; document.body.appendChild(s); setTimeout(()=>s.remove(),1000); }
function runApp(app,e){ if(!app||!app.run)return; const r=e.currentTarget.getBoundingClientRect(); slam('OPEN',r.left+r.width/2,r.top-10); setTimeout(()=>window.open(app.run.url,'_blank','noopener'),reduced?0:450); }
function downloadApp(app,e){ if(!app||!app.downloads||!app.downloads.length)return; const r=e.currentTarget.getBoundingClientRect();
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
  const acts=$('#dActs'); acts.innerHTML=`<button type="button" class="btn gold" ${app.run?'':'disabled'}>실행 · 새 탭에서 열기</button>${(app.downloads||[]).map((d,i)=>`<button type="button" class="btn line" data-i="${i}">↓ ${esc(d.label)}${d.size?` <small>(${esc(d.size)})</small>`:''}</button>`).join('')}`;
  $('.gold',acts).onclick=e=>{ripple(e);runApp(app,e)}; $$('.line',acts).forEach(b=>b.onclick=e=>{ripple(e);downloadApp(app,e)});
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
  dossier.classList.remove('on'); setTimeout(()=>{ dossier.hidden=true; dossier.classList.remove('ready'); document.body.classList.remove('lock'); if(card) card.focus({preventScroll:true}); },420);
}
function step(dir){ const live=APPS.filter(a=>a.status!=='soon'); const i=live.findIndex(a=>a.slug===current.slug); const n=live[(i+dir+live.length)%live.length]; if(!n||n===current)return;
  dossier.classList.remove('ready'); current=null; setTimeout(()=>{ history.replaceState({view:'project',slug:n.slug},'','/project/'+encodeURIComponent(n.slug)); current=n; currentCard=cardOf(n.slug); fillDossier(n); dossier.scrollTo({top:0,behavior:reduced?'auto':'smooth'}); requestAnimationFrame(()=>dossier.classList.add('ready')); },60); }
$('#dBack').addEventListener('click',()=>closeCase());
dossier.addEventListener('click',e=>{ if(e.target===dossier) closeCase(); });
$('#dPrev').addEventListener('click',()=>step(-1)); $('#dNext').addEventListener('click',()=>step(1));

/* ═══════════════ 작품집 (카드 묶음) 과 카드 뷰어 ═══════════════ */
function ratioWH(r){ const m=String(r||'1:1').split(':'); return {w:parseFloat(m[0])||1,h:parseFloat(m[1])||1}; }
function renderWorks(app){
  const sec=$('#dWorksSec'), box=$('#dWorks'); const works=(app.works||[]).filter(w=>w&&w.cards&&w.cards.length);
  sec.hidden=!works.length; if(!works.length){ box.innerHTML=''; return; }
  box.innerHTML=works.map((w,i)=>{ const r=ratioWH(w.ratio); return `<button type="button" class="work" data-i="${i}" style="--ar:${r.w}/${r.h}" aria-label="${esc(w.title)} 열어 보기"><div class="cover"><img src="${esc(w.cards[0])}" alt="" loading="lazy"><i></i></div><div class="cap"><b>${esc(w.title)}</b><span>${w.cards.length}장${w.date?' · '+esc(w.date):''}</span></div>${w.blurb?`<p class="blurb">${esc(w.blurb)}</p>`:''}</button>`; }).join('');
  $$('.work',box).forEach(el=>el.addEventListener('click',()=>openViewer(works[+el.dataset.i])));
}
const viewer=$('#viewer'), vStage=$('#vStage'); let V=null, vHintT=null;
function cardEl(src,cls){ const d=document.createElement('div'); d.className='v-card '+cls; d.innerHTML=`<img src="${esc(src)}" alt="" draggable="false">`; return d; }
function preloadCards(from){ for(let k=from;k<Math.min(from+3,V.work.cards.length);k++){ const im=new Image(); im.src=V.work.cards[k]; } }
function buildStack(first){ vStage.innerHTML=''; const c=V.work.cards; for(let k=2;k>=0;k--){ const idx=V.i+k; if(idx<c.length) vStage.appendChild(cardEl(c[idx], k===0?('cur'+(first?' first':'')):k===1?'next':'next2')); } vUpdate(); preloadCards(V.i+1); }
function vUpdate(){ const n=V.work.cards.length; $('#vCnt').textContent=String(V.i+1).padStart(2,'0')+' / '+String(n).padStart(2,'0');
  $('#vPrev').disabled=V.i===0; $('#vNext').disabled=false;
  const dots=$('#vDots'); if(n<=24){ dots.innerHTML=V.work.cards.map((_,k)=>`<i class="${k===V.i?'on':k<V.i?'seen':''}"></i>`).join(''); } else dots.innerHTML=''; }
function openViewer(work){ if(!work||!work.cards||!work.cards.length)return; V={work,i:0,busy:false}; const r=ratioWH(work.ratio); viewer.style.setProperty('--w',r.w); viewer.style.setProperty('--h',r.h);
  $('#vTitle').textContent=work.title||''; $('#vSub').textContent=[work.date,work.blurb].filter(Boolean).join(' · '); $('#vEndTitle').textContent=work.title||''; $('#vEnd').hidden=true; $('#vHint').classList.remove('off');
  viewer.hidden=false; buildStack(true); requestAnimationFrame(()=>viewer.classList.add('on')); document.body.classList.add('lock');
  clearTimeout(vHintT); vHintT=setTimeout(()=>$('#vHint').classList.add('off'),3500); $('#vNext').focus({preventScroll:true}); }
function closeViewer(){ if(viewer.hidden)return; viewer.classList.remove('on'); setTimeout(()=>{ viewer.hidden=true; vStage.innerHTML=''; V=null; if(dossier.hidden&&about.hidden) document.body.classList.remove('lock'); },350); }
function vStep(dir){ if(!V||V.busy)return; const n=V.i+dir, len=V.work.cards.length; if(n<0)return; if(!$('#vEnd').hidden){ if(dir<0){ $('#vEnd').hidden=true; } else return; }
  if(n>=len){ $('#vEnd').hidden=false; return; }
  V.busy=true; $('#vHint').classList.add('off');
  if(dir>0){ const out=$('.v-card.cur',vStage); V.i=n; buildStack(false); const cur=$('.v-card.cur',vStage); cur.classList.add('in'); if(out){ out.classList.remove('cur'); out.classList.add('out'); vStage.appendChild(out); setTimeout(()=>out.remove(),640); } }
  else { V.i=n; buildStack(false); const cur=$('.v-card.cur',vStage); cur.classList.add('back'); }
  setTimeout(()=>{ V.busy=false; },reduced?0:620); }
$('#vNext').addEventListener('click',()=>vStep(1)); $('#vPrev').addEventListener('click',()=>vStep(-1));
$('#vX').addEventListener('click',closeViewer); $('#vClose2').addEventListener('click',closeViewer);
$('#vAgain').addEventListener('click',()=>{ if(!V)return; $('#vEnd').hidden=true; V.i=0; buildStack(true); });
/* 탭·스와이프 */
(function(){ let sx=0, sy=0, t0=0, active=false;
  vStage.addEventListener('pointerdown',e=>{ sx=e.clientX; sy=e.clientY; t0=Date.now(); active=true; });
  vStage.addEventListener('pointerup',e=>{ if(!active)return; active=false; const dx=e.clientX-sx, dy=e.clientY-sy, dt=Date.now()-t0;
    if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.2){ vStep(dx<0?1:-1); return; }
    if(Math.abs(dx)<8&&Math.abs(dy)<8&&dt<400){ const r=vStage.getBoundingClientRect(); vStep((e.clientX-r.left)<r.width*.3?-1:1); } });
  vStage.addEventListener('pointercancel',()=>{active=false;});
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
$('#brand').addEventListener('click',e=>{ e.preventDefault(); if(current) closeCase(); if(!about.hidden) closeAbout(); scrollTo({top:0,behavior:reduced?'auto':'smooth'}); });
addEventListener('keydown',e=>{
  if(!viewer.hidden){ if(e.key==='Escape') closeViewer(); else if(e.key==='ArrowRight'||e.key===' '||e.key==='Enter'&&e.target===vStage){ e.preventDefault(); vStep(1); } else if(e.key==='ArrowLeft'){ e.preventDefault(); vStep(-1); } return; }
  if(e.key==='Escape'){ if(!lb.hidden) closeLb(); else if(current) closeCase(); else if(!about.hidden) closeAbout(); } });

/* ═══════════════ 주소 → 화면 ═══════════════ */
function parseLocation(){ const q=new URLSearchParams(location.search); let m=location.pathname.match(/^\/project\/([^/]+)\/?$/);
  if(m) return {view:'project',slug:decodeURIComponent(m[1])}; if(q.get('id')) return {view:'project',slug:q.get('id')};
  if(/^\/about\/?$/.test(location.pathname)) return {view:'about'}; return {view:'home'}; }
function parseTag(){ const h=location.hash.match(/^#tag=(.+)$/); if(h) return decodeURIComponent(h[1]); const q=new URLSearchParams(location.search); return q.get('tag')||'all'; }
addEventListener('popstate',()=>{ if(!viewer.hidden) closeViewer(); const l=parseLocation();
  if(l.view==='project'){ if(current&&current.slug===l.slug)return; if(current){ current=null; dossier.classList.remove('ready'); fillDossierSwap(l.slug); return; } if(!about.hidden) closeAbout(true); openCase(l.slug,cardOf(l.slug),false); }
  else if(l.view==='about'){ if(current) closeCase(true); openAbout(false); }
  else { if(current) closeCase(true); if(!about.hidden) closeAbout(true); } });
function fillDossierSwap(slug){ const n=APPS.find(a=>a.slug===slug&&a.status!=='soon'); if(!n){ closeCase(true); return; } setTimeout(()=>{ current=n; currentCard=cardOf(slug); fillDossier(n); dossier.scrollTo({top:0}); requestAnimationFrame(()=>dossier.classList.add('ready')); },60); }

/* ═══════════════ 시작: 데이터 읽기 ═══════════════ */
async function boot(){
  try{
    const r=await fetch('/data/apps.json',{cache:'no-cache'}); if(!r.ok) throw new Error(r.status);
    const data=await r.json(); SITE=data.site||{}; APPS=data.apps||[];
  }catch(e){
    grid.innerHTML='<div class="loading err">앱 목록(data/apps.json)을 읽지 못했습니다.<br>파일을 직접 열면(file://) 읽을 수 없어요 — 저장소 폴더에서 <code>npx serve -s .</code> 로 띄운 뒤 열어 주세요.</div>';
    return;
  }
  renderCards(); renderChips(); updateCount();
  setFilter(parseTag(),true);
  if(document.body.classList.contains('go')) revealCards();
  const l=parseLocation();
  const delay=document.body.classList.contains('go')?0:2600;
  if(l.view==='project') setTimeout(()=>openCase(l.slug,cardOf(l.slug),false),delay);
  else if(l.view==='about') setTimeout(()=>openAbout(false),delay);
  if(document.fonts) document.fonts.ready.then(()=>drawThread(false));
}
boot();
})();
