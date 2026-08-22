const fs = require('fs');
const path = require('path');
const { buildSnapshot } = require('./competition-publication.cjs');

const ROOT = path.resolve(__dirname, '..', '..');
const WEBSITE = path.join(ROOT, 'website');
const SNAPSHOT_PATH = path.join(WEBSITE, 'assets', 'competition-results.json');
const RUNTIME_PATH = path.join(WEBSITE, 'assets', 'competition-results-runtime.js');
const COMP_DIR = path.join(WEBSITE, 'competitions');
const SITEMAP_PATH = path.join(WEBSITE, 'sitemap.xml');
const ORIGIN = 'https://archery.catgroup.com.tw';

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const dateLabel = value => value ? esc(String(value).replaceAll('-', '/')) : '';
const jsonLd = value => JSON.stringify(value).replace(/</g, '\\u003c');
const paragraphs = value => esc(value).split(/\n{2,}/).filter(Boolean).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
const imageTag = (url, alt, cls='') => url ? `<img class="${cls}" src="${esc(url)}" alt="${esc(alt)}" loading="lazy" decoding="async">` : '';

function shell({ title, description, canonical, body, image = '', structured = [] }) {
  const ogImage = image || `${ORIGIN}/assets/images/archery/real/01_%E6%96%B0%E6%89%8B%E6%95%99%E5%AD%B8%E8%88%87%E9%A6%96%E9%A0%81%E4%B8%BB%E8%A6%96%E8%A6%BA/AAA00001-2.webp`;
  return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="index,follow,max-image-preview:large"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="article"><meta property="og:locale" content="zh_TW"><meta property="og:site_name" content="貓小隊室內射箭場"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(ogImage)}"><link rel="icon" href="/assets/logo.png">${structured.map(x => `<script type="application/ld+json">${jsonLd(x)}</script>`).join('')}
<style>:root{--paper:#f7f2e8;--paper2:#fffaf1;--ink:#292722;--muted:#676157;--orange:#b84c00;--green:#24463b;--line:#d9cdbb;--wrap:min(1120px,calc(100% - 32px))}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif;line-height:1.75}a{color:inherit}img{max-width:100%;display:block}.wrap{width:var(--wrap);margin:auto}.top{padding:22px 0;border-bottom:1px solid var(--line);background:rgba(255,250,241,.92)}.top .wrap{display:flex;justify-content:space-between;gap:18px;align-items:center}.brand{text-decoration:none;font-weight:900}.back{color:var(--orange);font-weight:800}.hero{padding:76px 0 48px}.eyebrow{color:var(--orange);font-weight:900;letter-spacing:.1em}.hero h1{font-size:clamp(2.2rem,6vw,4.3rem);line-height:1.1;margin:.2em 0}.lead{font-size:1.14rem;color:var(--muted);max-width:760px}.journey{display:flex;flex-wrap:wrap;gap:8px;margin-top:28px}.journey span{padding:8px 12px;border:1px solid var(--line);border-radius:999px;background:#fff;font-weight:800}.section{padding:54px 0}.alt{background:var(--paper2)}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.card{border:1px solid var(--line);border-radius:20px;background:#fff;overflow:hidden}.card img{width:100%;aspect-ratio:4/3;object-fit:cover}.card-body{padding:20px}.meta{color:var(--muted);font-size:.92rem}.pill{display:inline-block;padding:4px 9px;border-radius:999px;background:#f2e5d2;margin:3px;font-size:.78rem}.result{display:grid;grid-template-columns:1.1fr .8fr .8fr .8fr;gap:10px;padding:13px 0;border-top:1px solid var(--line)}.prose{max-width:780px}.gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.gallery img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:14px}.cover{width:100%;max-height:620px;object-fit:cover;border-radius:24px;margin:28px 0}.empty{padding:34px;border:1px dashed var(--line);border-radius:20px;background:#fff}.year{margin:42px 0 16px}.btn{display:inline-block;background:var(--orange);color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:900}@media(max-width:760px){.grid,.gallery{grid-template-columns:1fr}.result{grid-template-columns:1fr}.hero{padding-top:48px}}</style></head><body><header class="top"><div class="wrap"><a class="brand" href="/">貓小隊室內射箭場</a><a class="back" href="/competitions/">賽事紀錄</a></div></header>${body}</body></html>`;
}

function eventCard(event) {
  const awards = event.participants.filter(p => p.rank || p.award).slice(0, 3);
  return `<article class="card">${imageTag(event.coverImageUrl, `${event.title} 賽事紀錄`)}<div class="card-body"><div class="meta">${dateLabel(event.eventDate)}${event.location ? ` ・ ${esc(event.location)}` : ''}</div><h3>${esc(event.title)}</h3><p>${esc(event.summary || '記錄這一次從練習走到賽場的過程。')}</p>${awards.map(p => `<span class="pill">${esc(p.publicDisplayName)} ${esc(p.rank || p.award)}</span>`).join('')}<p><a class="back" href="/competitions/${encodeURIComponent(event.slug)}/">查看完整紀錄 →</a></p></div></article>`;
}

function archivePage(events) {
  const years = new Map();
  events.forEach(event => { const year = String(event.eventDate || '').slice(0, 4) || '其他'; if (!years.has(year)) years.set(year, []); years.get(year).push(event); });
  const history = events.length ? [...years.entries()].map(([year, rows]) => `<h3 class="year">${esc(year)} 年</h3><div class="grid">${rows.map(eventCard).join('')}</div>`).join('') : `<div class="empty"><h3>賽事紀錄正在累積</h3><p>之後每次帶隊參賽、射手完成比賽或取得成果，都會從後台發布到這裡。</p><a class="btn" href="/">回到射箭場首頁</a></div>`;
  const body = `<main><section class="hero"><div class="wrap"><p class="eyebrow">Competition & Team Results</p><h1>從第一次射箭，到真正站上賽場</h1><p class="lead">貓小隊不只提供射箭體驗。從第一次接觸、正確學習、固定練習，到正式參與比賽，我們陪射手一步一步往前走。這裡記錄的是教學、帶隊與射手長期成長，不只是獎牌。</p><div class="journey"><span>第一次體驗</span><span>→ 正確學習</span><span>→ 固定練習</span><span>→ 自備器材</span><span>→ 參與正式比賽</span><span>→ 持續成長</span></div></div></section><section class="section alt"><div class="wrap"><h2>歷年參賽與帶隊紀錄</h2>${history}</div></section></main>`;
  return shell({title:'帶隊比賽與賽事成果｜貓小隊室內射箭場',description:'貓小隊歷年帶隊參賽、射手成長與賽事成果紀錄。從第一次射箭、固定練習到正式站上賽場。',canonical:`${ORIGIN}/competitions/`,body,structured:[{'@context':'https://schema.org','@type':'CollectionPage',name:'貓小隊帶隊比賽與賽事成果',url:`${ORIGIN}/competitions/`}]});
}

function detailPage(event) {
  const canonical = `${ORIGIN}/competitions/${encodeURIComponent(event.slug)}/`;
  const desc = event.summary || `${event.title}｜貓小隊帶隊參賽與射手成長紀錄。`;
  const structured = [
    {'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'首頁',item:`${ORIGIN}/`},{'@type':'ListItem',position:2,name:'賽事紀錄',item:`${ORIGIN}/competitions/`},{'@type':'ListItem',position:3,name:event.title,item:canonical}]},
    {'@context':'https://schema.org','@type':'SportsEvent',name:event.title,startDate:event.eventDate || undefined,endDate:event.endDate || event.eventDate || undefined,location:event.location ? {'@type':'Place',name:event.location} : undefined,organizer:event.organizer ? {'@type':'Organization',name:event.organizer} : undefined,url:canonical,image:event.coverImageUrl ? [event.coverImageUrl] : undefined,description:desc},
    {'@context':'https://schema.org','@type':'Article',headline:event.title,datePublished:event.publishedAt || event.eventDate,dateModified:event.updatedAt || event.publishedAt || event.eventDate,description:desc,image:event.coverImageUrl || undefined,mainEntityOfPage:canonical,publisher:{'@type':'Organization',name:'貓小隊室內射箭場',url:`${ORIGIN}/`}},
  ];
  const rows = event.participants.length ? event.participants.map(p => `<div class="result"><strong>${esc(p.publicDisplayName || '參賽射手')}</strong><span>${esc([p.bowType,p.category].filter(Boolean).join('・'))}</span><span>${esc(p.score)}</span><span>${esc([p.rank,p.award,p.resultNote].filter(Boolean).join('・'))}</span></div>`).join('') : '<p class="meta">本場以帶隊／參賽紀錄為主，未公開個別射手資料。</p>';
  const body = `<main><section class="hero"><div class="wrap"><p class="eyebrow">${esc(event.eventType || 'Competition Record')}</p><h1>${esc(event.title)}</h1><p class="lead">${esc(desc)}</p><p class="meta">${dateLabel(event.eventDate)}${event.endDate && event.endDate !== event.eventDate ? `–${dateLabel(event.endDate)}` : ''}${event.location ? ` ・ ${esc(event.location)}` : ''}${event.organizer ? ` ・ ${esc(event.organizer)}` : ''}</p>${imageTag(event.coverImageUrl,event.title,'cover')}</div></section><section class="section alt"><div class="wrap"><h2>參賽與成果</h2>${rows}</div></section>${event.story ? `<section class="section"><div class="wrap prose"><h2>這次賽事紀錄</h2>${paragraphs(event.story)}</div></section>` : ''}${event.galleryImageUrls.length ? `<section class="section alt"><div class="wrap"><h2>賽場照片</h2><div class="gallery">${event.galleryImageUrls.map((url,i) => imageTag(url,`${event.title} 賽場照片 ${i+1}`)).join('')}</div></div></section>` : ''}<section class="section"><div class="wrap"><p class="lead">比賽不是終點，而是把平常練習帶到真實賽場的一次驗證。</p><a class="btn" href="/competitions/">回到歷年賽事紀錄</a></div></section></main>`;
  return shell({title:`${event.title}｜賽事成果｜貓小隊`,description:desc,canonical,body,image:event.coverImageUrl,structured});
}

function runtime(events) {
  const payload = JSON.stringify(events.slice(0, 1)).replace(/</g, '\\u003c');
  return `(function(){var events=${payload};function run(){var root=document.getElementById('competition-latest');if(!root)return;var e=events[0];if(!e){var empty=root.querySelector('[data-comp-empty]');if(empty)empty.hidden=false;return;}var empty=root.querySelector('[data-comp-empty]');if(empty)empty.hidden=true;var card=root.querySelector('[data-comp-card]');if(!card)return;card.hidden=false;card.querySelector('[data-comp-title]').textContent=e.title||'';card.querySelector('[data-comp-meta]').textContent=[e.eventDate,e.location].filter(Boolean).join(' ・ ');card.querySelector('[data-comp-summary]').textContent=e.summary||'記錄這一次從練習走到賽場的過程。';var link=card.querySelector('[data-comp-link]');link.href='/competitions/'+encodeURIComponent(e.slug)+'/';var pic=card.querySelector('[data-comp-image]');if(e.coverImageUrl){pic.src=e.coverImageUrl;pic.alt=e.title+' 賽事紀錄';pic.hidden=false;}else{pic.hidden=true;}}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();})();\n`;
}

function updateSitemap(events) {
  let xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
  xml = xml.replace(/\s*<url><!-- competition-generated -->[\s\S]*?<\/url>/g, '');
  const today = new Date().toISOString().slice(0,10);
  const urls = [`${ORIGIN}/competitions/`, ...events.map(e => `${ORIGIN}/competitions/${encodeURIComponent(e.slug)}/`)];
  const inserts = urls.map(url => `  <url><!-- competition-generated --><loc>${esc(url)}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>${url.endsWith('/competitions/') ? '0.8' : '0.6'}</priority></url>`).join('\n');
  xml = xml.replace('</urlset>', `${inserts ? '\n'+inserts+'\n' : ''}</urlset>`);
  fs.writeFileSync(SITEMAP_PATH, xml, 'utf8');
}
function cleanDetailDirs(allowedSlugs) {
  if (!fs.existsSync(COMP_DIR)) return;
  for (const entry of fs.readdirSync(COMP_DIR, {withFileTypes:true})) if (entry.isDirectory() && !allowedSlugs.has(entry.name)) fs.rmSync(path.join(COMP_DIR, entry.name), {recursive:true,force:true});
}
function generate() {
  fs.mkdirSync(path.dirname(SNAPSHOT_PATH), {recursive:true}); fs.mkdirSync(COMP_DIR, {recursive:true});
  const raw = fs.existsSync(SNAPSHOT_PATH) ? JSON.parse(fs.readFileSync(SNAPSHOT_PATH,'utf8').replace(/^\uFEFF/,'')) : {events:[]};
  const snapshot = buildSnapshot(raw);
  fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(snapshot,null,2)+'\n','utf8');
  fs.writeFileSync(path.join(COMP_DIR,'index.html'), archivePage(snapshot.events), 'utf8');
  cleanDetailDirs(new Set(snapshot.events.map(e => e.slug)));
  for (const event of snapshot.events) { const dir = path.join(COMP_DIR,event.slug); fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,'index.html'),detailPage(event),'utf8'); }
  fs.writeFileSync(RUNTIME_PATH,runtime(snapshot.events),'utf8'); updateSitemap(snapshot.events);
  console.log(`Generated ${snapshot.events.length} published competition page(s).`); return snapshot;
}
if (require.main === module) generate();
module.exports = { generate, archivePage, detailPage, runtime, updateSitemap };
