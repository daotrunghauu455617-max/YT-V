'use strict';
(() => {
/* =====================================================================
   YT Việt – xem YouTube không quảng cáo + phụ đề dịch Anh → Việt
   - Video: lấy luồng trực tiếp qua API của Piped (không dùng trình phát YouTube => không có quảng cáo)
   - Phụ đề: tải track phụ đề, dịch từng câu sang tiếng Việt, vẽ đè lên video
   ===================================================================== */

const $ = (s, r = document) => r.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem('ytv.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ytv.' + k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem('ytv.' + k); } catch {} }
};
const S = Object.assign({ instance: '', subs: true, showEN: false, fontSize: 18, bg: 55, quality: 'auto' }, store.get('settings', {}));
const saveS = () => store.set('settings', S);
let offset = 0; // lệch giờ phụ đề (giây), chỉ trong phiên xem

/* ---------- DOM ---------- */
const viewList = $('#viewList'), viewWatch = $('#viewWatch'), grid = $('#grid'), listMsg = $('#listMsg');
const player = $('#player'), video = $('#video'), subsBox = $('#subs'), subVI = $('#subs .vi'), subEN = $('#subs .en');
const badge = $('#badge'), spinner = $('#spinner'), notice = $('#notice'), noticeText = $('#noticeText'), noticeBtns = $('#noticeBtns');
const bPlay = $('#bPlay'), useP = $('#useP'), seek = $('#seek'), tCur = $('#tCur'), tDur = $('#tDur');
const bCC = $('#bCC'), pmenu = $('#pmenu'), selQ = $('#selQ'), selSpd = $('#selSpd'), selTrack = $('#selTrack');
const rngFont = $('#rngFont'), rngBg = $('#rngBg'), chkEN = $('#chkEN'), offV = $('#offV'), useFs = $('#useFs');

/* ---------- Tiện ích ---------- */
function fetchT(url, opt = {}, ms = 9000) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  return fetch(url, { ...opt, signal: ac.signal }).finally(() => clearTimeout(t));
}
function fmtTime(s) {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
function fmtViews(n) {
  if (!(n > 0)) return '';
  try { return new Intl.NumberFormat('vi', { notation: 'compact' }).format(n) + ' lượt xem'; } catch { return n + ' lượt xem'; }
}
function parseVideoId(s) {
  s = (s || '').trim();
  if (/^(?=.*[\d_A-Z-])[\w-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|embed\/|live\/|v\/))([\w-]{11})/);
  return m ? m[1] : null;
}
function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

/* =====================================================================
   1) API Piped (tự chọn máy chủ còn sống)
   ===================================================================== */
const FALLBACK_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.private.coffee',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.reallyaweso.me',
  'https://pipedapi.darkness.services',
  'https://pipedapi.leptons.xyz',
  'https://piped-api.garudalinux.org',
  'https://pipedapi.nosebs.ru',
  'https://pipedapi.r4fo.com',
  'https://api.piped.yt',
  'https://pipedapi.orangenet.cc',
  'https://pipedapi.ngn.tf',
  'https://pipedapi.drgns.space',
  'https://pipedapi.owo.si'
];
// Lấy danh sách NGAY (cache hoặc danh sách có sẵn), cập nhật danh sách mới ở nền -> không chờ.
function refreshInstances() {
  return (async () => {
    try {
      const r = await fetchT('https://piped-instances.kavin.rocks/', {}, 6000);
      const j = await r.json();
      const remote = j.filter(i => i && i.api_url && i.uptime_24h !== 0)
        .sort((a, b) => (b.uptime_24h || 0) - (a.uptime_24h || 0))
        .map(i => i.api_url.replace(/\/+$/, '')).slice(0, 10);
      if (remote.length) store.set('instCache', { t: Date.now(), list: [...new Set([...remote, ...FALLBACK_INSTANCES])] });
    } catch {}
  })();
}
async function loadInstances(force) {
  if (S.instance) return [S.instance.replace(/\/+$/, '')];
  const c = store.get('instCache', null);
  if (force) await refreshInstances();
  else if (!c || Date.now() - c.t > 6 * 3600e3) refreshInstances();
  const c2 = store.get('instCache', null);
  return c2 && c2.list && c2.list.length ? c2.list : FALLBACK_INSTANCES;
}
// Hỏi nhiều máy chủ cùng lúc, lấy máy trả lời đầu tiên.
async function apiX(path, skip = []) {
  const list = await loadInstances();
  const good = store.get('goodInst', '');
  const order = (good && list.includes(good) ? [good, ...list.filter(x => x !== good)] : list)
    .filter(b => !skip.includes(b)).slice(0, 10);
  if (!order.length) throw new Error('Không còn máy chủ để thử');
  const acs = [];
  return new Promise((resolve, reject) => {
    let left = order.length, last = new Error('Không có máy chủ');
    order.forEach(base => {
      const ac = new AbortController(); acs.push(ac);
      const t = setTimeout(() => ac.abort(), 7000);
      fetch(base + path, { signal: ac.signal })
        .then(async r => {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const j = await r.json();
          if (j && j.error) throw new Error(j.message || j.error);
          return j;
        })
        .then(j => { clearTimeout(t); store.set('goodInst', base); acs.forEach(a => a !== ac && a.abort()); resolve({ j, base }); })
        .catch(e => { clearTimeout(t); last = e; if (--left === 0) reject(last); });
    });
  });
}
const api = async (p, skip) => (await apiX(p, skip)).j;

/* =====================================================================
   2) Danh sách video
   ===================================================================== */
function idOf(it) { const m = (it.url || '').match(/[?&]v=([\w-]{11})/); return m ? m[1] : null; }

function card(it) {
  const id = it.id || idOf(it);
  if (!id) return null;
  const a = h('a', 'card'); a.href = '#/watch/' + id;
  const th = h('div', 'thumb');
  const img = new Image(); img.alt = ''; img.loading = 'lazy';
  const fb = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
  img.onerror = () => { img.onerror = null; img.src = fb; };
  img.src = it.thumbnail || fb;
  th.append(img);
  if (it.duration > 0) th.append(h('span', 'dur', fmtTime(it.duration)));
  const meta = h('div', 'cmeta');
  meta.append(h('div', 'ctitle', it.title || ''));
  const sub = [it.uploaderName, fmtViews(it.views), it.uploadedDate].filter(Boolean).join(' · ');
  if (sub) meta.append(h('div', 'csub', sub));
  a.append(th, meta);
  return a;
}
function fillGrid(target, items, { clear = true } = {}) {
  if (clear) target.textContent = '';
  let n = 0;
  for (const it of items || []) {
    if (it.type && it.type !== 'stream') continue;
    const c = card(it); if (c) { target.append(c); n++; }
  }
  return n;
}
function setMsg(text, retry) {
  listMsg.textContent = text || '';
  if (retry) { const b = h('button', 'btn', 'Thử lại'); b.onclick = retry; listMsg.append(document.createElement('br'), b); }
}

async function doHome() {
  grid.textContent = ''; setMsg('Đang tải video thịnh hành…');
  const hist = store.get('history', []);
  if (hist.length) { grid.append(h('h2', 'sep', 'Xem gần đây')); fillGrid(grid, hist.slice(0, 6), { clear: false }); }
  try {
    const items = await api('/trending?region=VN');
    if (!isHome()) return;
    grid.append(h('h2', 'sep', 'Thịnh hành tại Việt Nam'));
    fillGrid(grid, items, { clear: false });
    setMsg('');
  } catch (e) {
    if (isHome()) setMsg('Không kết nối được máy chủ Piped. Hãy dán link YouTube vào ô tìm kiếm, hoặc mở Cài đặt để đổi máy chủ.', doHome);
  }
}
async function doSearch(q) {
  grid.textContent = ''; setMsg('Đang tìm “' + q + '”…');
  try {
    const r = await api('/search?q=' + encodeURIComponent(q) + '&filter=videos');
    if (!location.hash.startsWith('#/search/')) return;
    const n = fillGrid(grid, r.items);
    setMsg(n ? '' : 'Không tìm thấy kết quả.');
  } catch (e) {
    setMsg('Tìm kiếm lỗi (máy chủ không phản hồi).', () => doSearch(q));
  }
}
const isHome = () => !location.hash || location.hash === '#/' || location.hash === '#';

/* =====================================================================
   3) Trình phát
   ===================================================================== */
let W = null; // trạng thái video đang xem
let hlsObj = null;

function stopWatch() {
  if (W) W.dead = true;
  W = null;
  try { video.pause(); } catch {}
  video.removeAttribute('src'); video.load();
  if (hlsObj) { try { hlsObj.destroy(); } catch {} hlsObj = null; }
  const f = $('iframe.yt', player); if (f) f.remove();
  player.classList.remove('iframe'); video.hidden = false;
  subVI.textContent = ''; subEN.textContent = '';
  notice.hidden = true; pmenu.hidden = true; badge.hidden = true; spinner.hidden = true;
  exitFs();
}

function route() {
  const hash = location.hash.slice(1) || '/';
  const m = hash.match(/^\/watch\/([\w-]{11})/);
  if (m) { showWatch(m[1]); return; }
  if (W) stopWatch();
  viewWatch.hidden = true; viewList.hidden = false;
  const s = hash.match(/^\/search\/(.+)/);
  if (s) { const q = decodeURIComponent(s[1]); $('#q').value = q; doSearch(q); }
  else doHome();
}

async function showWatch(id, skip = []) {
  viewList.hidden = true; viewWatch.hidden = false;
  if (W && W.id === id && !skip.length) return;
  stopWatch();
  const w = W = { id, data: null, streams: [], tracks: [], cues: [], curCue: null, needTr: false, sl: 'auto',
    trSeq: 0, trGen: 0, inflight: 0, fails: 0, base: '', skip, dead: false, errs: 0, q: 0, iframe: false };
  window.scrollTo(0, 0);
  offset = 0; offV.textContent = '0s';
  $('#title').textContent = 'Đang tải…'; $('#meta').textContent = ''; $('#desc').textContent = ''; $('#related').textContent = '';
  video.poster = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  setSpinner(true); setPlayIcon(false); showUI(true);

  let res;
  try { res = await apiX('/streams/' + id, skip); }
  catch { if (w.dead) return; return failNotice(w, 'Không kết nối được máy chủ phát không quảng cáo.'); }
  if (w.dead) return;
  const d = w.data = res.j; w.base = res.base;

  $('#title').textContent = d.title || '';
  $('#meta').textContent = [d.uploader, fmtViews(d.views), d.uploadDate].filter(Boolean).join(' · ');
  $('#desc').textContent = htmlToText(d.description || '');
  $('#descWrap').hidden = !d.description;
  fillGrid($('#related'), d.relatedStreams || []);
  document.title = (d.title || 'YT Việt') + ' – YT Việt';
  addHistory({ id, title: d.title, thumbnail: d.thumbnailUrl, uploaderName: d.uploader, duration: d.duration });
  setMediaSession(d);

  w.streams = pickStreams(d);
  buildQuality(w);
  if (!w.streams.length && !d.hls) return failNotice(w, 'Máy chủ này không trả về luồng video phát được.');
  startSource(w);
  loadSubs(w);
}

function htmlToText(html) {
  try {
    const doc = new DOMParser().parseFromString(String(html).replace(/<br\s*\/?>/gi, '\n'), 'text/html');
    return doc.body.textContent || '';
  } catch { return ''; }
}
function addHistory(it) {
  const l = store.get('history', []).filter(x => x.id !== it.id);
  l.unshift(it); store.set('history', l.slice(0, 30));
}
function setMediaSession(d) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: d.title || '', artist: d.uploader || '',
      artwork: d.thumbnailUrl ? [{ src: d.thumbnailUrl, sizes: '480x360' }] : [] });
    navigator.mediaSession.setActionHandler('play', () => video.play());
    navigator.mediaSession.setActionHandler('pause', () => video.pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => seekBy(-10));
    navigator.mediaSession.setActionHandler('seekforward', () => seekBy(10));
  } catch {}
}

/* ----- Chọn luồng video (đã gộp tiếng + hình) ----- */
function pickStreams(d) {
  const byQ = new Map();
  for (const s of (d.videoStreams || [])) {
    if (s.videoOnly || !s.url) continue;
    const q = parseInt(s.quality) || s.height || 0;
    const prev = byQ.get(q);
    if (!prev || (s.format === 'MPEG_4' && prev.format !== 'MPEG_4')) byQ.set(q, s);
  }
  return [...byQ.entries()].sort((a, b) => b[0] - a[0]).map(([q, s]) => ({ q, s }));
}
function buildQuality(w) {
  selQ.textContent = '';
  const o = document.createElement('option'); o.value = 'auto'; o.textContent = 'Tự động'; selQ.append(o);
  for (const { q } of w.streams) { const x = document.createElement('option'); x.value = String(q); x.textContent = q + 'p'; selQ.append(x); }
  selQ.value = S.quality;
  if (selQ.value !== S.quality) selQ.value = 'auto';
}
function chooseStream(w, exclude = []) {
  const list = w.streams.filter(x => !exclude.includes(x.q));
  if (!list.length) return null;
  if (S.quality !== 'auto') {
    const want = parseInt(S.quality);
    const best = list.find(x => x.q <= want) || list[list.length - 1];
    return best;
  }
  return list.find(x => x.q <= 720) || list[list.length - 1];
}
function startSource(w, resumeAt = 0, tried = []) {
  const pick = chooseStream(w, tried);
  if (!pick) {
    if (w.data.hls) return attachHls(w, w.data.hls);
    return failNotice(w, 'Không phát được video này.');
  }
  w.q = pick.q; w.tried = tried;
  const wasPlaying = resumeAt === 0 ? true : !video.paused;
  video.src = pick.s.url;
  video.playbackRate = parseFloat(selSpd.value) || 1;
  const onMeta = () => {
    if (resumeAt) { try { video.currentTime = resumeAt; } catch {} }
    if (wasPlaying) video.play().catch(() => { setSpinner(false); showUI(true); });
  };
  video.addEventListener('loadedmetadata', onMeta, { once: true });
  video.load();
}
async function attachHls(w, url) {
  try {
    if (video.canPlayType('application/vnd.apple.mpegurl')) { video.src = url; video.play().catch(() => {}); return; }
    if (!window.Hls) {
      await new Promise((ok, no) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js'; s.onload = ok; s.onerror = no; document.head.append(s);
      });
    }
    if (w.dead) return;
    hlsObj = new Hls(); hlsObj.loadSource(url); hlsObj.attachMedia(video);
    hlsObj.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
  } catch { failNotice(w, 'Không phát được luồng HLS.'); }
}

/* ----- Lỗi / dự phòng ----- */
function failNotice(w, msg) {
  if (w.dead) return;
  setSpinner(false);
  noticeText.textContent = msg;
  noticeBtns.textContent = '';
  const b1 = h('button', 'btn', 'Thử máy chủ khác');
  b1.onclick = () => { notice.hidden = true; showWatch(w.id, [...w.skip, w.base].filter(Boolean)); };
  const b2 = h('button', 'btn ghost', 'Xem bằng YouTube gốc (có quảng cáo)');
  b2.onclick = () => useIframe(w);
  noticeBtns.append(b1, b2);
  notice.hidden = false;
}
function useIframe(w) {
  if (!w || w.dead) return;
  video.pause(); video.hidden = true; notice.hidden = true; setSpinner(false);
  const f = document.createElement('iframe');
  f.className = 'yt';
  f.src = `https://www.youtube-nocookie.com/embed/${w.id}?autoplay=1&playsinline=1&rel=0&hl=vi&cc_lang_pref=vi&cc_load_policy=1`;
  f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; f.allowFullscreen = true;
  player.append(f); player.classList.add('iframe'); w.iframe = true;
}
video.addEventListener('error', () => {
  const w = W; if (!w || w.dead || w.iframe || !video.getAttribute('src')) return;
  const tried = [...(w.tried || []), w.q];
  if (chooseStream(w, tried)) { startSource(w, video.currentTime || 0, tried); setBadge('Chất lượng ' + w.q + 'p lỗi, đang thử bản khác…'); }
  else failNotice(w, 'Không phát được video từ máy chủ này.');
});

/* ----- Điều khiển ----- */
function setSpinner(on) { spinner.hidden = !on; }
function setPlayIcon(playing) { useP.setAttribute('href', playing ? '#i-pause' : '#i-play'); }
video.addEventListener('play', () => { setPlayIcon(true); showUI(); });
video.addEventListener('pause', () => { setPlayIcon(false); showUI(true); });
video.addEventListener('waiting', () => setSpinner(true));
video.addEventListener('seeking', () => setSpinner(true));
for (const ev of ['playing', 'canplay', 'seeked']) video.addEventListener(ev, () => setSpinner(false));
video.addEventListener('loadedmetadata', () => { tDur.textContent = fmtTime(dur()); });
video.addEventListener('durationchange', () => { tDur.textContent = fmtTime(dur()); });
video.addEventListener('ended', () => { setPlayIcon(false); showUI(true); });

const dur = () => (isFinite(video.duration) && video.duration > 0 ? video.duration : (W && W.data && W.data.duration) || 0);
function seekBy(s) { try { video.currentTime = Math.max(0, Math.min(dur() || 1e9, video.currentTime + s)); } catch {} showUI(); }
bPlay.onclick = () => { video.paused ? video.play().catch(() => {}) : video.pause(); };
$('#bBack').onclick = () => seekBy(-10);
$('#bFwd').onclick = () => seekBy(10);

let seeking = false;
seek.addEventListener('input', () => { seeking = true; tCur.textContent = fmtTime(seek.value / 1000 * dur()); showUI(true); });
seek.addEventListener('change', () => { try { video.currentTime = seek.value / 1000 * dur(); } catch {} seeking = false; showUI(); });

let uiTimer = 0;
function showUI(stay) {
  player.classList.add('ui'); clearTimeout(uiTimer);
  if (!stay && !video.paused && pmenu.hidden) uiTimer = setTimeout(() => player.classList.remove('ui'), 3000);
}
let lastTap = 0;
player.addEventListener('click', e => {
  if (e.target.closest('.ctrl-bot, .ctrl-mid .cbtn, .pmenu, .notice') || player.classList.contains('iframe')) return;
  if (!pmenu.hidden) { pmenu.hidden = true; return; }
  const now = Date.now();
  const r = player.getBoundingClientRect(), x = (e.clientX - r.left) / r.width;
  if (now - lastTap < 320 && (x < 0.33 || x > 0.67)) { seekBy(x < 0.33 ? -10 : 10); lastTap = 0; return; }
  lastTap = now;
  setTimeout(() => {
    if (lastTap !== now) return;
    if (player.classList.contains('ui') && !video.paused) player.classList.remove('ui'); else showUI();
  }, 330);
});

/* ----- Toàn màn hình (vẫn giữ phụ đề đè lên video) ----- */
function inFs() { return document.fullscreenElement === player || document.webkitFullscreenElement === player || player.classList.contains('pseudo'); }
function enterFs() {
  const req = player.requestFullscreen || player.webkitRequestFullscreen;
  if (req) {
    Promise.resolve(req.call(player)).then(() => { try { screen.orientation.lock('landscape').catch(() => {}); } catch {} }).catch(() => pseudoFs(true));
  } else pseudoFs(true); // iPhone: không hỗ trợ fullscreen cho thẻ khác video -> dùng toàn khung hình giả
}
function pseudoFs(on) {
  player.classList.toggle('pseudo', on); document.body.classList.toggle('noscroll', on); syncFs();
  if (on) { try { screen.orientation.lock('landscape').catch(() => {}); } catch {} }
}
function exitFs() {
  if (player.classList.contains('pseudo')) pseudoFs(false);
  const ex = document.exitFullscreen || document.webkitExitFullscreen;
  if ((document.fullscreenElement || document.webkitFullscreenElement) && ex) ex.call(document);
  try { screen.orientation.unlock(); } catch {}
}
function syncFs() {
  const on = inFs();
  player.classList.toggle('fs', on);
  useFs.setAttribute('href', on ? '#i-fsx' : '#i-fs');
  scaleSubs();
}
$('#bFs').onclick = () => (inFs() ? exitFs() : enterFs());
document.addEventListener('fullscreenchange', syncFs);
document.addEventListener('webkitfullscreenchange', syncFs);

/* ----- Menu tuỳ chọn trong trình phát ----- */
$('#bOpt').onclick = e => { e.stopPropagation(); pmenu.hidden = !pmenu.hidden; showUI(true); };
$('#pmClose').onclick = () => { pmenu.hidden = true; showUI(); };
selQ.onchange = () => {
  S.quality = selQ.value; saveS();
  if (W && !W.iframe && W.streams.length) startSource(W, video.currentTime || 0.01, []);
};
selSpd.onchange = () => { video.playbackRate = parseFloat(selSpd.value) || 1; };
selTrack.onchange = () => { if (W) useTrack(W, parseInt(selTrack.value)); };
rngFont.value = S.fontSize; rngBg.value = S.bg; chkEN.checked = S.showEN;
rngFont.oninput = () => { S.fontSize = +rngFont.value; saveS(); scaleSubs(); };
rngBg.oninput = () => { S.bg = +rngBg.value; saveS(); scaleSubs(); };
chkEN.onchange = () => { S.showEN = chkEN.checked; saveS(); render(); };
const setOffset = v => { offset = Math.round(v * 2) / 2; offV.textContent = (offset > 0 ? '+' : '') + offset + 's'; };
$('#offM').onclick = () => setOffset(offset - 0.5);
$('#offP').onclick = () => setOffset(offset + 0.5);
bCC.onclick = () => { S.subs = !S.subs; saveS(); bCC.classList.toggle('on', S.subs); render(); };
bCC.classList.toggle('on', S.subs);

function scaleSubs() {
  const w = player.clientWidth || 360;
  const k = Math.min(1.8, Math.max(1, Math.sqrt(w / 360)));
  subsBox.style.fontSize = (S.fontSize * k).toFixed(1) + 'px';
  player.style.setProperty('--sbg', `rgba(0,0,0,${S.bg / 100})`);
}
if ('ResizeObserver' in window) new ResizeObserver(scaleSubs).observe(player);
scaleSubs();

let badgeTimer = 0;
function setBadge(t, sticky) {
  clearTimeout(badgeTimer);
  if (!t) { badge.hidden = true; return; }
  badge.textContent = t; badge.hidden = false;
  if (!sticky) badgeTimer = setTimeout(() => { badge.hidden = true; }, 4500);
}

/* =====================================================================
   4) Phụ đề: tải → phân tích → dịch → hiển thị
   ===================================================================== */
async function fetchText(url) {
  const tries = [url,
    'https://corsproxy.io/?url=' + encodeURIComponent(url),
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(url)];
  for (const u of tries) {
    try {
      const r = await fetchT(u, {}, 10000);
      if (r.ok) { const t = await r.text(); if (t && t.length > 10) return t; }
    } catch {}
  }
  throw new Error('subs');
}

const unesc = t => t.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\{\\an\d\}/g, '').replace(/[ \t ]+/g, ' ').trim();
const toLines = raw => String(raw).split(/\n|<br\s*\/?>/i).map(unesc).filter(Boolean);
function tsec(s) { return s.replace(',', '.').split(':').map(parseFloat).reduce((a, v) => a * 60 + v, 0); }

function parseCaptions(txt) {
  txt = txt.replace(/^﻿/, '').trim();
  const raw = [];
  const push = (a, b, t) => { const lines = toLines(t); if (lines.length && isFinite(a) && isFinite(b)) raw.push({ start: a, end: b, lines }); };
  if (txt[0] === '{') {                                   // json3
    const j = JSON.parse(txt);
    for (const e of j.events || []) if (e.segs) push(e.tStartMs / 1000, (e.tStartMs + (e.dDurationMs || 2000)) / 1000, e.segs.map(s => s.utf8).join(''));
  } else if (txt[0] === '<' && !/^<\s*(WEBVTT)/i.test(txt)) { // xml: srv1 / srv3 / ttml
    const doc = new DOMParser().parseFromString(txt, 'text/xml');
    doc.querySelectorAll('text').forEach(n => { const s = parseFloat(n.getAttribute('start')), d = parseFloat(n.getAttribute('dur') || 2); push(s, s + d, n.textContent); });
    doc.querySelectorAll('p').forEach(n => {
      if (n.hasAttribute('t')) { const s = +n.getAttribute('t') / 1000, d = +(n.getAttribute('d') || 2000) / 1000; push(s, s + d, n.textContent); }
      else if (n.hasAttribute('begin')) {
        const tt = v => /s$/.test(v) ? parseFloat(v) : tsec(v);
        push(tt(n.getAttribute('begin')), tt(n.getAttribute('end')), n.innerHTML.replace(/<br[^>]*>/gi, '\n').replace(/<[^>]+>/g, m => m));
      }
    });
  } else {                                                // WebVTT
    for (const b of txt.replace(/\r/g, '').split(/\n{2,}/)) {
      const ls = b.split('\n'), i = ls.findIndex(l => l.includes('-->'));
      if (i < 0) continue;
      const m = ls[i].match(/((?:\d+:)?\d+:\d+(?:[.,]\d+)?)\s*-->\s*((?:\d+:)?\d+:\d+(?:[.,]\d+)?)/);
      if (m) push(tsec(m[1]), tsec(m[2]), ls.slice(i + 1).join('\n'));
    }
  }
  raw.sort((a, b) => a.start - b.start);
  const out = [];
  for (const c of raw) {
    const p = out[out.length - 1];
    if (p) {                                              // bỏ dòng lặp của phụ đề tự động kiểu "cuộn"
      while (c.lines.length > 1 && p.lines.includes(c.lines[0])) c.lines.shift();
      if (c.lines.join(' ') === p.lines.join(' ')) { p.end = Math.max(p.end, c.end); continue; }
      if (p.end > c.start && c.start > p.start) p.end = c.start;
    }
    c.text = c.lines.join(' ');
    out.push(c);
  }
  return out;
}

function chooseTrack(tr) {
  const f = fn => tr.findIndex(fn);
  const vi = t => /^vi/i.test(t.code), en = t => /^en/i.test(t.code);
  for (const fn of [t => vi(t) && !t.autoGenerated, t => en(t) && !t.autoGenerated, en, t => !t.autoGenerated]) {
    const i = f(fn); if (i >= 0) return i;
  }
  return 0;
}
async function loadSubs(w) {
  const tr = (w.data.subtitles || []).filter(t => t && t.url);
  w.tracks = tr;
  selTrack.textContent = '';
  const off = document.createElement('option'); off.value = '-1'; off.textContent = 'Tắt phụ đề'; selTrack.append(off);
  tr.forEach((t, i) => {
    const o = document.createElement('option'); o.value = String(i);
    o.textContent = (t.name || t.code) + (t.autoGenerated ? ' (tự động)' : '') + (/^vi/i.test(t.code) ? '' : ' → dịch sang Việt');
    selTrack.append(o);
  });
  bCC.disabled = !tr.length;
  if (!tr.length) { setBadge('Video này không có phụ đề'); return; }
  const pick = chooseTrack(tr);
  selTrack.value = String(pick);
  await useTrack(w, pick);
}
async function useTrack(w, i) {
  const my = ++w.trSeq;
  w.trGen++; w.cues = []; w.curCue = null; render();
  if (i < 0) { setBadge(''); return; }
  const t = w.tracks[i];
  setBadge('Đang tải phụ đề…', true);
  let txt;
  try { txt = await fetchText(t.url); } catch { if (!w.dead && my === w.trSeq) setBadge('Không tải được phụ đề'); return; }
  if (w.dead || my !== w.trSeq) return;
  let cues = [];
  try { cues = parseCaptions(txt); } catch {}
  if (!cues.length) { setBadge('Phụ đề trống hoặc không đọc được'); return; }
  w.cues = cues;
  w.needTr = !/^vi/i.test(t.code);
  w.sl = (t.code || 'auto').split(/[-_]/)[0] || 'auto';
  w.fails = 0;
  setBadge(w.needTr ? 'Phụ đề: ' + w.sl.toUpperCase() + ' → VI' : 'Phụ đề tiếng Việt');
  pump();
}

/* ----- Dịch ----- */
const trCache = new Map();
async function gtx(text, sl) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&tl=vi&sl=' + encodeURIComponent(sl) + '&q=' + encodeURIComponent(text);
  const r = await fetchT(url, {}, 8000);
  if (!r.ok) throw new Error('gtx ' + r.status);
  const j = await r.json();
  const out = (j[0] || []).map(x => x[0]).join('').trim();
  if (!out) throw new Error('empty');
  return out;
}
async function myMemory(text, sl) {
  const from = sl === 'auto' ? 'en' : sl;
  const r = await fetchT('https://api.mymemory.translated.net/get?langpair=' + from + '|vi&q=' + encodeURIComponent(text.slice(0, 480)), {}, 8000);
  const j = await r.json();
  const out = j && j.responseData && j.responseData.translatedText;
  if (!out || /MYMEMORY WARNING/i.test(out)) throw new Error('mm');
  return out;
}
async function translateText(text, sl) {
  const key = sl + '|' + text;
  if (trCache.has(key)) return trCache.get(key);
  let out;
  try { out = await gtx(text, sl); } catch { out = await myMemory(text, sl); }
  if (trCache.size > 3000) trCache.clear();
  trCache.set(key, out);
  return out;
}

const AHEAD = 30, CONC = 4;
function firstIdx(cues, t) {
  let lo = 0, hi = cues.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (cues[m].end > t) hi = m; else lo = m + 1; }
  return lo;
}
function cueAt(cues, t) {
  let lo = 0, hi = cues.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (cues[m].start <= t) { r = m; lo = m + 1; } else hi = m - 1; }
  for (let k = r; k >= 0 && k > r - 3; k--) if (cues[k].end > t) return cues[k];
  return null;
}
function pump() {
  const w = W; if (!w || w.dead || !w.needTr || !w.cues.length) return;
  const now = Date.now();
  const i = firstIdx(w.cues, video.currentTime + offset - 0.5);
  for (let k = i; k < Math.min(w.cues.length, i + AHEAD) && w.inflight < CONC; k++) {
    const c = w.cues[k];
    if (c.vi != null || c.busy || (c.fails || 0) >= 3 || (c.retryAt || 0) > now) continue;
    runTr(w, c);
  }
}
async function runTr(w, c) {
  c.busy = true; w.inflight++;
  const gen = w.trGen;
  try {
    const vi = await translateText(c.text, w.sl);
    if (gen === w.trGen) { c.vi = vi; w.fails = 0; }
  } catch {
    if (gen === w.trGen) { c.fails = (c.fails || 0) + 1; c.retryAt = Date.now() + 1500 * c.fails; if (++w.fails === 8) setBadge('Dịch đang lỗi – kiểm tra mạng'); }
  } finally {
    c.busy = false; w.inflight--;
    if (!w.dead && gen === w.trGen) { if (w.curCue === c) render(); setTimeout(pump, 0); }
  }
}

function render() {
  const w = W;
  const c = w && w.curCue;
  if (!w || !c || !S.subs) { subVI.textContent = ''; subEN.textContent = ''; return; }
  subVI.classList.remove('pending');
  if (!w.needTr) { subVI.textContent = c.text; subEN.textContent = ''; return; }
  if (c.vi != null) { subVI.textContent = c.vi; subEN.textContent = S.showEN ? c.text : ''; }
  else { subVI.textContent = c.text; subVI.classList.add('pending'); subEN.textContent = ''; }
}

let tickN = 0;
setInterval(() => {
  const w = W;
  if (!w || viewWatch.hidden || w.iframe) return;
  const t = video.currentTime;
  if (!seeking) { const d = dur(); seek.value = d ? Math.min(1000, t / d * 1000) : 0; tCur.textContent = fmtTime(t); }
  const c = cueAt(w.cues, t + offset);
  if (c !== w.curCue) { w.curCue = c; render(); }
  if (++tickN % 5 === 0) pump();
}, 100);

/* =====================================================================
   5) Nút chức năng, cài đặt, khởi động
   ===================================================================== */
$('#btnShare').onclick = async () => {
  if (!W) return;
  const url = 'https://youtu.be/' + W.id;
  try { if (navigator.share) await navigator.share({ title: (W.data && W.data.title) || '', url }); else { await navigator.clipboard.writeText(url); setBadge('Đã chép link'); } } catch {}
};
$('#btnIframe').onclick = () => W && useIframe(W);
$('#btnReload').onclick = () => { if (!W) return; const id = W.id, sk = W.skip; W.id = null; showWatch(id, sk.length ? sk : []); };

$('#searchForm').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('#q').value.trim(); if (!v) return;
  $('#q').blur();
  const id = parseVideoId(v);
  const target = id ? '#/watch/' + id : '#/search/' + encodeURIComponent(v);
  if (location.hash === target) route(); else location.hash = target;
});

const sheet = $('#sheet'), instInput = $('#instInput'), instMsg = $('#instMsg');
$('#btnSettings').onclick = () => { instInput.value = S.instance || ''; instMsg.textContent = 'Máy chủ gần nhất dùng được: ' + (store.get('goodInst', '') || 'chưa có'); sheet.hidden = false; };
$('#sheetClose').onclick = () => { sheet.hidden = true; };
sheet.addEventListener('click', e => { if (e.target === sheet) sheet.hidden = true; });
$('#instSave').onclick = () => {
  const v = instInput.value.trim().replace(/\/+$/, '');
  if (v && !/^https?:\/\//i.test(v)) { instMsg.textContent = 'Địa chỉ phải bắt đầu bằng https://'; return; }
  S.instance = v; saveS(); store.del('instCache'); store.del('goodInst');
  instMsg.textContent = v ? 'Đã lưu máy chủ riêng.' : 'Đã chuyển về chế độ tự động.';
};
$('#instTest').onclick = async () => {
  instMsg.textContent = 'Đang kiểm tra…';
  const typed = instInput.value.trim().replace(/\/+$/, '');
  const list = typed ? [typed] : [...new Set([...(await loadInstances(true)), ...FALLBACK_INSTANCES])];
  const res = await Promise.all(list.map(async b => {
    try { const r = await fetchT(b + '/trending?region=VN', {}, 7000); if (!r.ok) throw 0; await r.json(); return b; } catch { return null; }
  }));
  const ok = res.filter(Boolean);
  instMsg.textContent = ok.length ? `✔ ${ok.length}/${list.length} máy chủ hoạt động: ` + ok.join(', ')
    : `✖ Cả ${list.length} máy chủ đều không phản hồi (YouTube đang chặn hoặc mạng lỗi). Xem phần “Nếu app không phát được” trong hướng dẫn.`;
  if (ok.length && !typed) store.set('goodInst', ok[0]);
};
$('#btnClear').onclick = () => {
  if (!confirm('Xoá lịch sử xem và đặt lại cài đặt?')) return;
  ['settings', 'history', 'instCache', 'goodInst'].forEach(store.del); location.reload();
};

/* Cài PWA */
let deferredInstall = null;
const btnInstall = $('#btnInstall'), installHint = $('#installHint');
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; btnInstall.hidden = false; });
btnInstall.onclick = async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; btnInstall.hidden = true; };
window.addEventListener('appinstalled', () => { btnInstall.hidden = true; installHint.textContent = 'Đã cài xong!'; });
installHint.textContent = isStandalone ? 'Bạn đang dùng bản đã cài.'
  : isIOS ? 'iPhone/iPad: mở bằng Safari → nút Chia sẻ → “Thêm vào MH chính”.'
  : 'Android (Chrome): menu ⋮ → “Cài đặt ứng dụng” / “Thêm vào màn hình chính”.';

/* Nhận link chia sẻ từ app YouTube (Android, khi đã cài PWA) */
(() => {
  const p = new URLSearchParams(location.search);
  const raw = [p.get('url'), p.get('text'), p.get('title')].filter(Boolean).join(' ');
  if (!raw) return;
  const id = parseVideoId(raw);
  history.replaceState(null, '', location.pathname + (id ? '#/watch/' + id : ''));
})();

addEventListener('hashchange', route);
route();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
