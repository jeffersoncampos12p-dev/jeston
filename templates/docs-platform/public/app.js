(() => {
  const key = 'ryvax-demo-documents-v1';
  const seed = [
    { title: 'Getting started', slug: 'getting-started', status: 'Published', views: '2,840', updated: '2 min ago', color: 'coral' },
    { title: 'Routing and rendering', slug: 'routing', status: 'Published', views: '1,248', updated: 'Yesterday', color: 'mint' },
    { title: 'Supabase and Stripe', slug: 'integrations', status: 'Draft', views: '—', updated: 'Sep 8, 2026', color: 'purple' },
    { title: 'Changelog · September', slug: 'changelog', status: 'Draft', views: '—', updated: 'Sep 5, 2026', color: 'yellow' }
  ];
  let docs = read();
  let activeSearch = '';
  const root = document.querySelector('.saas-app');
  if (!root) return;
  const list = () => root.querySelector('.app-doc-list');
  const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  function read() { try { return JSON.parse(localStorage.getItem(key)) || seed; } catch (_) { return seed.slice(); } }
  function save() { try { localStorage.setItem(key, JSON.stringify(docs)); } catch (_) {} }
  function toast(message) { const old = root.querySelector('.demo-toast'); old?.remove(); const node = document.createElement('div'); node.className = 'toast demo-toast'; node.textContent = `✓ ${message}`; root.append(node); setTimeout(() => node.remove(), 2400); }
  function render() {
    const filtered = docs.filter((doc) => `${doc.title} ${doc.slug} ${doc.status}`.toLowerCase().includes(activeSearch.toLowerCase()));
    if (list()) list().innerHTML = filtered.map((doc) => `<a class="app-doc-row" href="#edit-${escape(doc.slug)}" data-demo-doc="${escape(doc.slug)}"><span class="doc-square ${escape(doc.color)}">#</span><span class="app-doc-name"><b>${escape(doc.title)}</b><small>/docs/${escape(doc.slug)}</small></span><span class="status ${doc.status.toLowerCase()}">${doc.status}</span><span class="doc-views">${escape(doc.views)}</span><span class="doc-updated">${escape(doc.updated)}</span><span class="row-arrow">→</span></a>`).join('') || '<div class="demo-empty">No documents match your search.</div>';
    const count = root.querySelector('.app-nav a[href*="#content"] i'); if (count) count.textContent = docs.length;
    const published = root.querySelector('.stat-card:nth-child(2) strong'); if (published) published.innerHTML = `${docs.filter((doc) => doc.status === 'Published').length}<i> / ${docs.length}</i>`;
    bindRows();
  }
  function modal(content) { const old = document.querySelector('.demo-modal-wrap'); old?.remove(); const wrap = document.createElement('div'); wrap.className = 'editor-overlay demo-modal-wrap'; wrap.innerHTML = `<div class="editor-modal">${content}</div>`; document.body.append(wrap); wrap.addEventListener('click', (event) => { if (event.target === wrap || event.target.closest('[data-close]')) wrap.remove(); }); return wrap; }
  function editor(doc) {
    const isNew = !doc; const current = doc || { title: 'Untitled guide', slug: `untitled-${Date.now()}`, status: 'Draft', views: '—', updated: 'Just now', color: 'blue' };
    const wrap = modal(`<div class="editor-modal-head"><span class="eyebrow">${isNew ? 'New document' : 'Document editor'}</span><button class="close-btn" data-close>×</button></div><input class="editor-title" value="${escape(current.title)}" data-title><input class="editor-slug" value="/docs/${escape(current.slug)}" data-slug><div class="editor-toolbar"><b>B</b><i>I</i><span>H1</span><span>☷</span><span>🔗</span></div><textarea class="editor-body" data-body># ${escape(current.title)}\n\nWrite something useful for your readers.\n\nThis is a functional frontend demo. Backend persistence is intentionally disabled.</textarea><div class="editor-footer"><span>Saved locally · Backend disabled</span><div><button class="app-secondary" data-close>Cancel</button><button class="app-primary" data-save>Save document</button></div></div>`);
    wrap.querySelector('[data-save]').addEventListener('click', () => { const title = wrap.querySelector('[data-title]').value.trim() || 'Untitled guide'; const next = { ...current, title, updated: 'Just now', status: current.status || 'Draft' }; const index = docs.findIndex((item) => item.slug === current.slug); if (index >= 0) docs[index] = next; else docs.unshift(next); save(); render(); wrap.remove(); toast('Document saved locally'); });
  }
  function bindRows() { root.querySelectorAll('[data-demo-doc]').forEach((row) => row.addEventListener('click', (event) => { event.preventDefault(); editor(docs.find((doc) => doc.slug === row.dataset.demoDoc)); })); }
  function search() { const wrap = modal(`<div class="editor-modal-head"><span class="eyebrow">Workspace search</span><button class="close-btn" data-close>×</button></div><input class="editor-title demo-search-input" placeholder="Search documents…" autofocus><div class="demo-search-results"></div>`); const input = wrap.querySelector('input'); const results = wrap.querySelector('.demo-search-results'); const update = () => { const query = input.value.toLowerCase(); results.innerHTML = docs.filter((doc) => doc.title.toLowerCase().includes(query) || doc.slug.includes(query)).map((doc) => `<button class="demo-result" data-result="${escape(doc.slug)}"><b>${escape(doc.title)}</b><small>/docs/${escape(doc.slug)} · ${doc.status}</small></button>`).join('') || '<p class="demo-empty">No results.</p>'; results.querySelectorAll('[data-result]').forEach((button) => button.addEventListener('click', () => { wrap.remove(); editor(docs.find((doc) => doc.slug === button.dataset.result)); })); }; input.addEventListener('input', update); update(); }
  root.querySelectorAll('a[href*="workspace/new"]').forEach((button) => button.addEventListener('click', (event) => { event.preventDefault(); editor(); }));
  root.querySelectorAll('.icon-btn').forEach((button) => button.addEventListener('click', search));
  root.querySelectorAll('.app-nav a[href*="#content"], .text-btn').forEach((button) => button.addEventListener('click', (event) => { event.preventDefault(); root.querySelector('.recent-panel')?.scrollIntoView({ behavior: 'smooth' }); toast('Content library ready'); }));
  root.querySelectorAll('.app-nav a[href*="pricing"], .app-nav a[href*="login"]').forEach((button) => button.addEventListener('click', () => toast('This frontend demo keeps backend settings disabled')));
  render();
})();
