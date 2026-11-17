/* Comidas y Cenas: recetas de Instagram guardadas en el propio móvil. */
(() => {
  'use strict';

  const DIFF = {
    facil: { label: 'Fácil', emoji: '🥗' },
    medio: { label: 'Medio', emoji: '🍝' },
    dificil: { label: 'Difícil', emoji: '🥘' },
  };
  const IG_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.3" fill="currentColor"/></svg>';
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  /* ---------- Almacenamiento (IndexedDB, con localStorage de reserva) ---------- */
  const DB_NAME = 'comidas-y-cenas';
  const KEY = 'recipes';
  let dbPromise = null;

  function openDB() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('sin IndexedDB'));
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  async function loadRecipes() {
    try {
      const db = await openDB();
      const data = await new Promise((resolve, reject) => {
        const req = db.transaction('kv').objectStore('kv').get(KEY);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (Array.isArray(data)) return data;
    } catch (e) { /* usamos localStorage */ }
    try {
      const raw = localStorage.getItem(DB_NAME);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  async function saveRecipes() {
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(recipes, KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      return true;
    } catch (e) {
      try {
        localStorage.setItem(DB_NAME, JSON.stringify(recipes));
        return true;
      } catch (e2) {
        toast('No se pudo guardar: el almacenamiento está lleno.');
        return false;
      }
    }
  }

  /* ---------- Enlaces de vídeo ---------- */
  function parseVideo(url) {
    if (!url) return null;
    const s = url.trim();
    let m = s.match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i);
    if (m) {
      const kind = m[1].toLowerCase() === 'reels' ? 'reel' : m[1].toLowerCase();
      return {
        type: 'instagram',
        url: `https://www.instagram.com/${kind}/${m[2]}/`,
        embed: `https://www.instagram.com/${kind}/${m[2]}/embed/captioned/`,
      };
    }
    m = s.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
    if (m) {
      return { type: 'youtube', url: s, embed: `https://www.youtube-nocookie.com/embed/${m[1]}` };
    }
    if (/^https?:\/\//i.test(s)) return { type: 'link', url: s, embed: null };
    return null;
  }

  function extractUrl(text) {
    const m = (text || '').match(/https?:\/\/\S+/);
    return m ? m[0] : (text || '').trim();
  }

  // Usa el script oficial de Instagram, que ajusta solo la altura del vídeo.
  let igScript = null;
  function processInstagram() {
    if (window.instgrm && window.instgrm.Embeds) { window.instgrm.Embeds.process(); return; }
    if (igScript) return;
    igScript = document.createElement('script');
    igScript.async = true;
    igScript.src = 'https://www.instagram.com/embed.js';
    igScript.onload = () => window.instgrm && window.instgrm.Embeds.process();
    igScript.onerror = () => { igScript = null; igFallback(); };
    document.head.appendChild(igScript);
    setTimeout(igFallback, 8000);
  }
  // Si el script de Instagram no carga, se usa el reproductor incrustado simple.
  function igFallback() {
    $$('blockquote.instagram-media').forEach((bq) => {
      const url = bq.dataset.instgrmPermalink;
      if (!url) return;
      const f = document.createElement('iframe');
      f.src = url + 'embed/' + (bq.hasAttribute('data-instgrm-captioned') ? 'captioned/' : '');
      f.loading = 'lazy';
      f.allowFullscreen = true;
      f.title = 'Vídeo de la receta';
      f.style.height = '720px';
      bq.replaceWith(f);
    });
  }

  function videoHTML(video, cover, captioned) {
    if (video && video.type === 'instagram') {
      return { cls: ' ig', html: `<blockquote class="instagram-media" data-instgrm-permalink="${esc(video.url)}"
        data-instgrm-version="14"${captioned ? ' data-instgrm-captioned' : ''}
        style="margin:0;max-width:100%;min-width:0;width:100%;border:0;border-radius:0;box-shadow:none;background:var(--surface)">
        <a class="no-video" href="${esc(video.url)}" target="_blank" rel="noopener">Cargando vídeo de Instagram…</a></blockquote>` };
    }
    if (video && video.embed) {
      const cls = video.type === 'youtube' ? ' youtube' : '';
      return { cls, html: `<iframe src="${esc(video.embed)}" loading="lazy" allowfullscreen
        allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
        referrerpolicy="strict-origin-when-cross-origin" title="Vídeo de la receta"></iframe>` };
    }
    if (cover) return { cls: '', html: `<img class="cover" src="${cover}" alt="">` };
    return { cls: '', html: '<div class="no-video">Esta receta no tiene vídeo.</div>' };
  }

  /* ---------- Utilidades ---------- */
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function guessTitle(text) {
    const first = (text || '').split('\n').map((l) => l.trim()).find((l) => l.length > 2);
    if (!first) return '';
    const clean = first.replace(/#[\p{L}\d_]+/gu, '').replace(/[\p{Extended_Pictographic}️]/gu, '').trim();
    return clean.length > 60 ? clean.slice(0, 57).trim() + '…' : clean;
  }
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  }

  async function resizeImage(file, max = 640) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = url;
      });
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.78);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /* ---------- Estado ---------- */
  let recipes = [];
  let filter = 'all';
  let query = '';
  let formPhoto = null;
  const doneLines = {}; // líneas tachadas en esta sesión, por receta

  /* ---------- Navegación ---------- */
  const views = ['list', 'detail', 'form', 'settings'];
  function show(name) {
    views.forEach((v) => { $('#view-' + v).hidden = v !== name; });
    window.scrollTo(0, 0);
  }
  function go(hash) { location.hash = hash; }
  function back() {
    if (history.length > 1 && sessionStorage.getItem('navigated')) history.back();
    else go('#/');
  }

  function route() {
    const h = location.hash.replace(/^#\/?/, '');
    const [page, id] = h.split('/');
    if (page) { try { sessionStorage.setItem('navigated', '1'); } catch (e) {} }
    if (page === 'r' && id) return renderDetail(id);
    if (page === 'nueva') return renderForm(null);
    if (page === 'editar' && id) return renderForm(id);
    if (page === 'ajustes') return renderSettings();
    renderList();
  }

  /* ---------- Lista ---------- */
  function renderList() {
    show('list');
    const counts = { all: recipes.length, facil: 0, medio: 0, dificil: 0 };
    recipes.forEach((r) => { counts[r.difficulty] = (counts[r.difficulty] || 0) + 1; });
    $$('[data-count]').forEach((el) => { el.textContent = counts[el.dataset.count] || 0; });
    $$('#filters .chip').forEach((c) => c.classList.toggle('active', c.dataset.filter === filter));

    const q = norm(query);
    const items = recipes
      .filter((r) => filter === 'all' || (filter === 'fav' ? r.favorite : r.difficulty === filter))
      .filter((r) => !q || norm(r.title + ' ' + r.text).includes(q))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    $('#empty').hidden = recipes.length !== 0;
    $('#noresults').hidden = recipes.length === 0 || items.length !== 0;
    $('#list').innerHTML = items.map((r) => {
      const d = DIFF[r.difficulty] || DIFF.facil;
      const bg = r.photo ? ` style="background-image:url('${r.photo}')"` : '';
      const ig = r.url && /instagram\.com/i.test(r.url)
        ? `<a class="ig-open" href="${esc(r.url)}" aria-label="Abrir en Instagram">${IG_ICON}</a>` : '';
      return `<article class="card-recipe" data-id="${esc(r.id)}" role="button" tabindex="0">
        <div class="thumb"${bg}>${r.photo ? '' : d.emoji}${r.favorite ? '<span class="fav">★</span>' : ''}${ig}</div>
        <div class="card-body">
          <div class="card-title">${esc(r.title)}</div>
          <div class="card-meta"><span class="dot ${r.difficulty}"></span>${d.label}${r.time ? ' · ' + esc(r.time) : ''}</div>
        </div>
      </article>`;
    }).join('');
  }

  /* ---------- Detalle ---------- */
  function renderDetail(id) {
    const r = recipes.find((x) => x.id === id);
    if (!r) return go('#/');
    show('detail');
    const d = DIFF[r.difficulty] || DIFF.facil;
    $('#d-title').textContent = r.title;
    $('#d-diff').innerHTML = `<span class="dot ${r.difficulty}"></span>${d.label}`;
    $('#d-time').textContent = r.time ? '⏱ ' + r.time : '';
    const fav = $('#d-fav');
    fav.textContent = r.favorite ? '★' : '☆';
    fav.classList.toggle('on', !!r.favorite);

    const video = parseVideo(r.url);
    const v = videoHTML(video, r.photo, !(r.text || '').trim());
    const box = $('#d-video');
    box.className = 'video' + v.cls;
    box.innerHTML = v.html;
    if (video && video.type === 'instagram') processInstagram();
    const open = $('#d-open');
    open.hidden = !video;
    if (video) {
      open.href = video.url;
      open.textContent = video.type === 'instagram' ? 'Abrir en Instagram' : 'Abrir enlace';
    }

    const done = doneLines[r.id] || (doneLines[r.id] = new Set());
    const lines = (r.text || '').split('\n');
    $('#d-text').innerHTML = (r.text || '').trim()
      ? lines.map((l, i) => l.trim()
        ? `<div class="line${done.has(i) ? ' done' : ''}" data-i="${i}">${esc(l)}</div>`
        : '<div class="line blank"></div>').join('')
      : '<div class="empty-text">Sin texto. Pulsa Editar para pegar los ingredientes.</div>';
    $('#view-detail').dataset.id = r.id;
  }

  /* ---------- Formulario ---------- */
  function renderForm(id) {
    const r = id ? recipes.find((x) => x.id === id) : null;
    if (id && !r) return go('#/');
    show('form');
    $('#f-heading').textContent = r ? 'Editar receta' : 'Nueva receta';
    $('#form').dataset.id = r ? r.id : '';
    const pre = r ? null : takePrefill();
    $('#f-url').value = r ? (r.url || '') : (pre?.url || '');
    $('#f-title').value = r ? r.title : (pre?.title || '');
    $('#f-time').value = r ? (r.time || '') : '';
    $('#f-text').value = r ? (r.text || '') : (pre?.text || '');
    if (!r && pre?.text && !pre?.title) $('#f-title').value = guessTitle(pre.text);
    const diff = r ? r.difficulty : 'facil';
    $$('input[name=diff]').forEach((i) => { i.checked = i.value === diff; });
    setPhoto(r ? r.photo || null : null);
    updateUrlPreview();
  }

  function setPhoto(dataUrl) {
    formPhoto = dataUrl;
    const p = $('#f-photo-preview');
    p.style.backgroundImage = dataUrl ? `url('${dataUrl}')` : '';
    p.textContent = dataUrl ? '' : '📷';
    $('#f-photo-remove').hidden = !dataUrl;
  }

  let lastPreview = '';
  function updateUrlPreview() {
    const raw = $('#f-url').value;
    const msg = $('#f-url-msg');
    const prev = $('#f-preview');
    const video = parseVideo(raw);
    if (!raw.trim()) {
      msg.textContent = ''; msg.className = 'field-msg';
      prev.hidden = true; prev.innerHTML = ''; lastPreview = '';
      return;
    }
    if (!video) {
      msg.textContent = 'Eso no parece un enlace.'; msg.className = 'field-msg error';
      prev.hidden = true; prev.innerHTML = ''; lastPreview = '';
      return;
    }
    msg.textContent = video.type === 'instagram' ? '✓ Vídeo de Instagram' : (video.type === 'youtube' ? '✓ Vídeo de YouTube' : 'Enlace guardado (sin vista previa)');
    msg.className = 'field-msg ' + (video.embed ? 'ok' : '');
    if (video.embed && video.embed !== lastPreview) {
      const v = videoHTML(video);
      prev.className = 'video small' + v.cls;
      prev.innerHTML = v.html;
      lastPreview = video.embed;
      if (video.type === 'instagram') processInstagram();
    }
    prev.hidden = !video.embed;
  }

  async function onSubmit(e) {
    e.preventDefault();
    const id = $('#form').dataset.id;
    const rawUrl = $('#f-url').value.trim();
    const video = parseVideo(rawUrl);
    const text = $('#f-text').value.replace(/\s+$/, '');
    let title = $('#f-title').value.trim() || guessTitle(text);
    if (!title) {
      $('#f-title').focus();
      return toast('Ponle un nombre a la receta.');
    }
    if (rawUrl && !video) {
      $('#f-url').focus();
      return toast('Revisa el enlace.');
    }
    const data = {
      title,
      url: video ? video.url : '',
      difficulty: ($$('input[name=diff]').find((i) => i.checked) || {}).value || 'facil',
      time: $('#f-time').value.trim(),
      text,
      photo: formPhoto,
      updatedAt: Date.now(),
    };
    let target;
    if (id) {
      target = recipes.find((x) => x.id === id);
      Object.assign(target, data);
    } else {
      target = { id: uid(), createdAt: Date.now(), favorite: false, ...data };
      recipes.unshift(target);
    }
    if (await saveRecipes()) {
      toast('Receta guardada');
      location.replace('#/r/' + target.id);
    }
  }

  /* ---------- Atajo de iOS / enlaces con datos: ?url=…&text=…&title=… ---------- */
  let prefill = null;
  function readPrefill() {
    const p = new URLSearchParams(location.search);
    const url = p.get('url') || '';
    const text = p.get('text') || '';
    const title = p.get('title') || '';
    if (!url && !text && !title) return;
    // A veces el atajo manda el enlace dentro del texto.
    const foundUrl = url ? extractUrl(url) : (parseVideo(extractUrl(text)) ? extractUrl(text) : '');
    prefill = { url: foundUrl, text: text && text.trim() !== foundUrl ? text : '', title };
    history.replaceState(null, '', location.pathname + '#/nueva');
  }
  function takePrefill() { const p = prefill; prefill = null; return p; }

  /* ---------- Ajustes ---------- */
  function renderSettings() {
    show('settings');
    $('#s-msg').textContent = '';
    const n = recipes.length;
    $('#s-stats').textContent = `${n} receta${n === 1 ? '' : 's'} guardada${n === 1 ? '' : 's'}`;
  }

  function exportData() {
    const payload = JSON.stringify({ app: 'comidas-y-cenas', version: 1, exportedAt: new Date().toISOString(), recipes }, null, 1);
    const name = `recetas-${new Date().toISOString().slice(0, 10)}.json`;
    const file = new File([payload], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: 'Copia de recetas' }).catch(() => {});
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  async function importData(file) {
    const msg = $('#s-msg');
    try {
      const json = JSON.parse(await file.text());
      const list = Array.isArray(json) ? json : json.recipes;
      if (!Array.isArray(list)) throw new Error('formato');
      const byId = new Map(recipes.map((r) => [r.id, r]));
      let added = 0, updated = 0;
      list.forEach((r) => {
        if (!r || !r.title) return;
        const clean = {
          id: String(r.id || uid()),
          title: String(r.title),
          url: String(r.url || ''),
          difficulty: DIFF[r.difficulty] ? r.difficulty : 'facil',
          time: String(r.time || ''),
          text: String(r.text || ''),
          photo: typeof r.photo === 'string' && r.photo.startsWith('data:image/') ? r.photo : null,
          favorite: !!r.favorite,
          createdAt: Number(r.createdAt) || Date.now(),
          updatedAt: Number(r.updatedAt) || Date.now(),
        };
        if (byId.has(clean.id)) { Object.assign(byId.get(clean.id), clean); updated++; }
        else { recipes.push(clean); byId.set(clean.id, clean); added++; }
      });
      await saveRecipes();
      renderSettings();
      msg.className = 'field-msg ok';
      msg.textContent = `Importadas: ${added} nuevas, ${updated} actualizadas.`;
    } catch (e) {
      msg.className = 'field-msg error';
      msg.textContent = 'Ese archivo no es una copia válida.';
    }
  }

  /* ---------- Eventos ---------- */
  function bind() {
    window.addEventListener('hashchange', route);
    $$('[data-back]').forEach((b) => b.addEventListener('click', back));
    $('#btn-add').addEventListener('click', () => go('#/nueva'));
    $('#btn-settings').addEventListener('click', () => go('#/ajustes'));

    $('#search').addEventListener('input', (e) => { query = e.target.value; renderList(); });
    $('#filters').addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      filter = chip.dataset.filter;
      renderList();
    });
    $('#list').addEventListener('click', (e) => {
      if (e.target.closest('a')) return; // el icono de Instagram abre la app
      const card = e.target.closest('.card-recipe');
      if (card) go('#/r/' + card.dataset.id);
    });

    // Detalle
    $('#d-text').addEventListener('click', (e) => {
      const line = e.target.closest('.line:not(.blank)');
      if (!line) return;
      const id = $('#view-detail').dataset.id;
      const set = doneLines[id] || (doneLines[id] = new Set());
      const i = Number(line.dataset.i);
      if (set.has(i)) set.delete(i); else set.add(i);
      line.classList.toggle('done');
    });
    $('#d-fav').addEventListener('click', async () => {
      const r = recipes.find((x) => x.id === $('#view-detail').dataset.id);
      if (!r) return;
      r.favorite = !r.favorite;
      await saveRecipes();
      $('#d-fav').textContent = r.favorite ? '★' : '☆';
      $('#d-fav').classList.toggle('on', r.favorite);
    });
    $('#d-edit').addEventListener('click', () => go('#/editar/' + $('#view-detail').dataset.id));
    $('#d-delete').addEventListener('click', async () => {
      const id = $('#view-detail').dataset.id;
      const r = recipes.find((x) => x.id === id);
      if (!r || !confirm(`¿Borrar «${r.title}»?`)) return;
      recipes = recipes.filter((x) => x.id !== id);
      await saveRecipes();
      toast('Receta borrada');
      location.replace('#/');
    });

    // Formulario
    $('#form').addEventListener('submit', onSubmit);
    let t;
    $('#f-url').addEventListener('input', () => { clearTimeout(t); t = setTimeout(updateUrlPreview, 350); });
    $('#f-url').addEventListener('blur', () => {
      const el = $('#f-url');
      const u = extractUrl(el.value);
      if (u !== el.value) el.value = u;
      updateUrlPreview();
    });
    $('#f-text').addEventListener('blur', () => {
      if (!$('#f-title').value.trim()) $('#f-title').value = guessTitle($('#f-text').value);
    });
    $$('[data-paste]').forEach((btn) => btn.addEventListener('click', async () => {
      const target = $('#' + btn.dataset.paste);
      try {
        const text = await navigator.clipboard.readText();
        if (!text) return toast('El portapapeles está vacío.');
        if (target.id === 'f-url') {
          target.value = extractUrl(text);
          updateUrlPreview();
        } else {
          target.value = target.value ? target.value + '\n' + text : text;
          if (!$('#f-title').value.trim()) $('#f-title').value = guessTitle(text);
        }
      } catch (e) {
        target.focus();
        toast('Mantén pulsado el campo y elige «Pegar».');
      }
    }));
    $('#f-photo').addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (!file) return;
      try { setPhoto(await resizeImage(file)); } catch (err) { toast('No se pudo leer la foto.'); }
    });
    $('#f-photo-remove').addEventListener('click', () => setPhoto(null));

    // Ajustes
    $('#s-export').addEventListener('click', exportData);
    $('#s-import').addEventListener('change', (e) => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';
      if (f) importData(f);
    });
  }

  async function init() {
    readPrefill();
    bind();
    recipes = await loadRecipes();
    route();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  init();
})();
