/* 家計在庫アプリ（Web版） */
(() => {
  const el = s => document.querySelector(s);
  const els = s => Array.from(document.querySelectorAll(s));

  const STORAGE_KEY = 'householdInventoryData.v1';

  /**
   * データ構造
   * items: [{ name, category, reorderPoint, unit, note, initialStock }]
   * history: [{ date, item, type: '購入'|'使用', qty, note }]
   */
  const defaultData = {
    items: [
      { name: '牛乳', category: '乳製品', reorderPoint: 1, unit: '本', note: '', initialStock: 0 },
      { name: '卵', category: '乳製品', reorderPoint: 1, unit: 'パック', note: '', initialStock: 0 },
      { name: '洗濯用洗剤', category: '日用品', reorderPoint: 1, unit: '個', note: '', initialStock: 0 },
    ],
    history: []
  };

  const load = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return structuredClone(defaultData);
      const parsed = JSON.parse(raw);
      parsed.items ??= [];
      parsed.history ??= [];
      return parsed;
    } catch (e) {
      console.warn('Load failed, fallback to default', e);
      return structuredClone(defaultData);
    }
  };
  const save = (data) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

  let state = load();

  // ---- UI: Tabs ----
  function switchTab(name){
    els('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    els('.tab-section').forEach(sec => sec.classList.toggle('visible', sec.id === `tab-${name}`));
  }
  els('.tabs button').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.tab)));
  els('[data-switch]').forEach(a => a.addEventListener('click', () => switchTab(a.dataset.switch)));

  // ---- Helpers ----
  const todayStr = () => new Date().toISOString().slice(0,10);

  function findItemIndex(name){
    return state.items.findIndex(i => i.name === name);
  }

  function ensureItemExists(name){
    let idx = findItemIndex(name);
    if (idx === -1){
      // 未登録 → 末尾に自動追加（初期値はカテゴリ空, 発注点1, 単位"個"）
      state.items.push({ name, category: '', reorderPoint: 1, unit: '個', note: '', initialStock: 0 });
      idx = state.items.length - 1;
      save(state);
      renderDatalist();
      renderMaster();
    }
    return idx;
  }

  // ---- Derived Aggregations ----
  function aggregate(){
    const bought = new Map();
    const used = new Map();
    for (const h of state.history){
      const map = h.type === '購入' ? bought : h.type === '使用' ? used : null;
      if (!map) continue;
      map.set(h.item, (map.get(h.item) || 0) + Number(h.qty||0));
    }
    const rows = state.items.map(it => {
      const cBuy = (bought.get(it.name) || 0);
      const cUse = (used.get(it.name) || 0);
      const current = Number(it.initialStock||0) + cBuy - cUse;
      const status = current <= Number(it.reorderPoint||0) ? '⚠ 発注必要' : 'OK';
      return { ...it, bought: cBuy, used: cUse, current, status };
    });
    return rows;
  }

  // ---- KPI ----
  function renderKPI(){
    el('#kpi-today').textContent = todayStr();
    const rows = aggregate();
    el('#kpi-items').textContent = String(rows.length);
    el('#kpi-zero').textContent = String(rows.filter(r => r.current === 0).length);
    el('#kpi-reorder').textContent = String(rows.filter(r => r.current <= (r.reorderPoint||0)).length);
  }

  // ---- Datalist ----
  function renderDatalist(){
    const dl = el('#items-list');
    if (!dl) return;
    dl.innerHTML = state.items
      .slice()
      .sort((a,b)=>a.name.localeCompare(b.name,'ja'))
      .map(it => `<option value="${it.name}"></option>`)
      .join('');
  }

  // ---- Input (purchase/use) ----
  function renderRecent(){
    const tb = el('#recent-input-table tbody');
    const last = state.history.slice(-20).reverse();
    tb.innerHTML = last.map((h,idx)=>
      `<tr><td>${h.date}</td><td>${h.item}</td><td>${h.type}</td><td>${h.qty}</td><td>${h.note||''}</td>
       <td><button class="btn" data-del="${state.history.length-1-idx}">削除</button></td></tr>`
    ).join('');
    tb.querySelectorAll('button[data-del]').forEach(btn => btn.addEventListener('click', () => {
      const i = Number(btn.dataset.del);
      state.history.splice(i,1); save(state);
      renderAll();
    }));
  }

  function setupInput(){
    el('#in-date').value = todayStr();
    const form = el('#purchase-form');
    form.addEventListener('submit', e => {
      e.preventDefault();
      const date = el('#in-date').value || todayStr();
      const name = (el('#in-item').value || '').trim();
      const type = el('#in-type').value;
      const qty = Math.max(1, Number(el('#in-qty').value||1));
      const note = el('#in-note').value.trim();
      if (!name) return;
      ensureItemExists(name);
      state.history.push({ date, item: name, type, qty, note });
      save(state);
      el('#in-item').value = '';
      el('#in-qty').value = '1';
      el('#in-note').value = '';
      renderAll();
    });

    // ショートカット：直近入力の品目に+1購入（例示的）
    el('#btn-bulk-add').addEventListener('click', () => {
      const last = state.history.filter(h=>h.type==='購入').slice(-1)[0];
      const name = last?.item || state.items[0]?.name;
      if (!name) return;
      ensureItemExists(name);
      state.history.push({ date: todayStr(), item: name, type: '購入', qty: 1, note: 'ショートカット' });
      save(state); renderAll();
    });
  }

  // ---- Inventory table ----
  function renderInventory(){
    const rows = aggregate();
    const q = (el('#inv-search').value || '').toLowerCase();
    const cat = el('#inv-filter-cat').value || '';
    const tbody = el('#inventory-table tbody');
    const filtered = rows.filter(r =>
      (!q || r.name.toLowerCase().includes(q)) && (!cat || r.category === cat)
    );
    tbody.innerHTML = filtered.map(r => {
      const low = r.current <= (r.reorderPoint||0);
      return `<tr class="${low ? 'low':''}"><td>${r.name}</td><td>${r.initialStock||0}</td><td>${r.bought}</td><td>${r.used}</td><td>${r.current}</td><td>${r.reorderPoint||0}</td><td>${r.status}</td><td>${r.category||''}</td></tr>`;
    }).join('');
  }

  function setupInventoryFilters(){
    const cats = Array.from(new Set(state.items.map(i=>i.category).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'ja'));
    const sel = el('#inv-filter-cat');
    sel.innerHTML = '<option value="">すべてのカテゴリ</option>' + cats.map(c=>`<option value="${c}">${c}</option>`).join('');
    el('#inv-search').addEventListener('input', renderInventory);
    sel.addEventListener('change', renderInventory);
  }

  // ---- History ----
  function renderHistory(){
    const tb = el('#history-table tbody');
    tb.innerHTML = state.history.map(h => `<tr><td>${h.date}</td><td>${h.item}</td><td>${h.type}</td><td>${h.qty}</td><td>${h.note||''}</td></tr>`).join('');
  }
  function setupHistoryActions(){
    el('#btn-clear-history').addEventListener('click', () => {
      if (!confirm('履歴を全削除しますか？')) return;
      state.history = []; save(state); renderAll();
    });
  }

  // ---- Shopping list ----
  function renderShopping(){
    const rows = aggregate().filter(r => r.current <= (r.reorderPoint||0));
    const tb = el('#shopping-table tbody');
    tb.innerHTML = rows.map(r => {
      const suggest = Math.max(1, (r.reorderPoint||0) - r.current);
      const unit = state.items.find(i=>i.name===r.name)?.unit || '';
      const note = state.items.find(i=>i.name===r.name)?.note || '';
      return `<tr><td>${r.name}</td><td>${r.current}</td><td>${r.reorderPoint||0}</td><td>${unit}</td><td>${note}</td><td>${suggest}</td></tr>`;
    }).join('');

    const text = rows.map(r => {
      const suggest = Math.max(1, (r.reorderPoint||0) - r.current);
      const unit = state.items.find(i=>i.name===r.name)?.unit || '';
      return `・${r.name} ${suggest}${unit}`;
    }).join('\n');
    el('#shopping-text').value = text || '（発注必要な品目はありません）';
  }
  function setupShoppingActions(){
    el('#btn-copy-shopping').addEventListener('click', async () => {
      const text = el('#shopping-text').value;
      await navigator.clipboard.writeText(text);
      alert('買い物リストをコピーしました');
    });
  }

  // ---- Master ----
  function renderMaster(){
    const tb = el('#master-table tbody');
    tb.innerHTML = state.items
      .slice().sort((a,b)=>a.name.localeCompare(b.name,'ja'))
      .map((it,idx)=> `<tr><td>${it.name}</td><td>${it.category||''}</td><td>${it.reorderPoint||0}</td><td>${it.unit||''}</td><td>${it.note||''}</td><td><button class="btn" data-edit="${idx}">編集</button> <button class="btn danger" data-del="${idx}">削除</button></td></tr>`)
      .join('');

    tb.querySelectorAll('button[data-edit]').forEach(btn => btn.addEventListener('click', () => {
      const it = state.items[Number(btn.dataset.edit)];
      el('#m-item').value = it.name;
      el('#m-cat').value = it.category || '';
      el('#m-reorder').value = it.reorderPoint ?? 1;
      el('#m-unit').value = it.unit || '個';
      el('#m-note').value = it.note || '';
      switchTab('master');
    }));

    tb.querySelectorAll('button[data-del]').forEach(btn => btn.addEventListener('click', () => {
      const i = Number(btn.dataset.del);
      if (!confirm(`「${state.items[i].name}」を削除しますか？\n※ 履歴は残ります。`)) return;
      const name = state.items[i].name;
      state.items.splice(i,1);
      save(state);
      // 履歴は残す。集計で見えなくなるだけ。
      renderAll();
    }));

    renderDatalist();
    setupInventoryFilters();
  }

  function setupMasterForm(){
    el('#master-form').addEventListener('submit', e => {
      e.preventDefault();
      const name = el('#m-item').value.trim(); if(!name) return;
      const idx = ensureItemExists(name);
      state.items[idx].category = el('#m-cat').value.trim();
      state.items[idx].reorderPoint = Number(el('#m-reorder').value||0);
      state.items[idx].unit = el('#m-unit').value.trim() || '個';
      state.items[idx].note = el('#m-note').value.trim();
      save(state);
      renderAll();
      alert('登録/更新しました');
      e.target.reset();
    });
  }

  // ---- Settings ----
  function setupSettings(){
    el('#btn-export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(state,null,2)], {type:'application/json'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'inventory-backup.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
    el('#btn-import').addEventListener('click', () => el('#file-import').click());
    el('#file-import').addEventListener('change', async (ev) => {
      const file = ev.target.files[0]; if(!file) return;
      const txt = await file.text();
      try {
        const data = JSON.parse(txt);
        if (!Array.isArray(data.items) || !Array.isArray(data.history)) throw new Error('フォーマット不正');
        state = data; save(state); renderAll(); alert('読み込みました');
      } catch(e){ alert('読み込みに失敗しました: '+e.message); }
      ev.target.value = '';
    });
    el('#btn-reset').addEventListener('click', () => {
      if(!confirm('初期化します。よろしいですか？')) return;
      state = structuredClone(defaultData); save(state); renderAll();
    });
  }

  // ---- Init ----
  function renderAll(){
    renderKPI();
    renderInventory();
    renderHistory();
    renderShopping();
    renderMaster();
    renderRecent();
  }

  function init(){
    // date default
    if (el('#in-date')) el('#in-date').value = todayStr();
    setupInput();
    setupInventoryFilters();
    setupHistoryActions();
    setupShoppingActions();
    setupMasterForm();
    setupSettings();
    renderAll();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
