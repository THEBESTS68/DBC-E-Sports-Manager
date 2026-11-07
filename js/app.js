// =====================================================================
//  DBC NextGen E-Sport — Tournament Manager
// =====================================================================
const { escapeHTML, processImageUrl } = UI;

const BYE = 'BYE (ชนะผ่าน)';
const EMPTY = '---';
const GAME_META = {
  ef:  { label: 'eFootball',  title: 'eFootball Playoff',    subtitle: 'สายการแข่งขันแบบ Single Elimination • BO3', entrant: 'player', rulesTitle: 'กติกาการแข่งขัน eFootball' },
  rov: { label: 'Garena RoV', title: 'Garena RoV Playoff',   subtitle: 'สายการแข่งขันแบบ Single Elimination • BO3', entrant: 'team',   rulesTitle: 'กติกาการแข่งขัน Garena RoV' },
  ff:  { label: 'Free Fire',  title: 'Free Fire Scoreboard', subtitle: 'ระบบคำนวณคะแนน 3 แมตช์สะสม (Squad)',        entrant: 'team',   rulesTitle: 'กติกาการแข่งขัน Garena Free Fire' }
};
const FF_POINTS = { 1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3 };
const FF_MAX_RANK = 50, FF_MAX_KILLS = 99;

let store = null;
let state = StoreUtils.normalizeState(null);
let loaded = false;
let currentGame = null;

const isAdmin = () => !!store && store.auth.isAdmin();
const $ = id => document.getElementById(id);

// =====================================================================
//  BOOT
// =====================================================================
window.addEventListener('DOMContentLoaded', async () => {
  bindStaticEvents();
  applyRoute();
  renderAuth();
  try {
    store = await createStore();
    await store.init();
  } catch (err) {
    console.error(err);
    setConnection(false, 'เชื่อมต่อฐานข้อมูลไม่สำเร็จ');
    UI.toast('เชื่อมต่อฐานข้อมูลไม่สำเร็จ: ' + err.message, 'error');
    return;
  }
  store.onConnection(ok => setConnection(ok));
  store.auth.onChange(() => render());
  store.subscribe(s => { state = s; loaded = true; render(); });
  renderAuth();
});

function setConnection(ok, text) {
  const el = $('dbStatus');
  el.textContent = text || (ok ? 'ONLINE' : 'OFFLINE');
  el.classList.toggle('online', ok);
  el.classList.toggle('offline', !ok);
}

// =====================================================================
//  ROUTING (#ef / #rov / #ff) — ปุ่ม Back ของเบราว์เซอร์และการรีเฟรชหน้าใช้ได้
// =====================================================================
function openGame(gameId) { location.hash = gameId; }
function goHome() { if (location.hash) history.pushState('', document.title, location.pathname + location.search); applyRoute(); }
window.addEventListener('hashchange', applyRoute);

function applyRoute() {
  const id = location.hash.slice(1);
  const next = GAME_META[id] ? id : null;
  if (next === currentGame && document.body.dataset.routed) return;
  document.body.dataset.routed = '1';
  document.body.classList.add('page-fade-out');
  setTimeout(() => {
    currentGame = next;
    document.body.setAttribute('data-theme', next || 'default');
    $('homeMenu').style.display = next ? 'none' : '';
    $('profileHub').style.display = next ? 'none' : '';
    $('btnBack').style.display = next ? '' : 'none';
    document.querySelectorAll('.module').forEach(m => m.classList.remove('active', 'page-fade-in'));
    if (next) {
      $('mainTitle').textContent = GAME_META[next].title;
      $('mainSubtitle').textContent = GAME_META[next].subtitle;
      $(`module-${next}`).classList.add('active', 'page-fade-in');
    } else {
      $('mainTitle').textContent = 'Tournament Manager';
      $('mainSubtitle').textContent = 'เลือกระบบจัดการการแข่งขันที่ต้องการ';
      $('homeMenu').classList.add('page-fade-in');
      $('profileHub').classList.add('page-fade-in');
    }
    document.body.classList.remove('page-fade-out');
    render();
    window.scrollTo({ top: 0 });
  }, document.body.dataset.firstRoute ? 250 : 0);
  document.body.dataset.firstRoute = '1';
}

// =====================================================================
//  RENDER
// =====================================================================
function render() {
  renderAuth();
  if (typeof renderReviewPanel === 'function') renderReviewPanel();
  if (!currentGame) { renderProfiles(); return; }
  renderEntrants(currentGame);
  if (currentGame === 'ff') renderFFTable(); else renderBracket(currentGame);
}

function renderAuth() {
  const admin = isAdmin();
  document.body.classList.toggle('viewer-mode', !admin);
  $('authContainer').innerHTML = admin
    ? `<button class="lens lens-sm" onclick="logoutAdmin()" title="ออกจากระบบกรรมการ">🔓 <span class="hide-sm">ออกจากระบบ</span></button>`
    : `<button class="lens lens-sm" onclick="loginAdmin()" title="สำหรับกรรมการ">🔒 <span class="hide-sm">กรรมการ</span></button>`;
}

// =====================================================================
//  AUTH
// =====================================================================
// หน้าต่างเข้าสู่ระบบ / สมัครกรรมการ อยู่ใน registration.js
function loginAdmin() {
  if (!store) return UI.toast('ยังเชื่อมต่อฐานข้อมูลไม่สำเร็จ', 'error');
  openAuth('login');
}

async function logoutAdmin() {
  await store.auth.logout();
  UI.toast('ออกจากระบบแล้ว', 'info');
  render();
}

// =====================================================================
//  SAVE
// =====================================================================
async function saveGame(gameId) {
  if (!isAdmin()) return;
  render(); // แสดงผลทันที ไม่ต้องรอฐานข้อมูลตอบกลับ
  try { await store.saveGame(gameId, state[gameId]); UI.toast('💾 บันทึกแล้ว'); }
  catch (err) { UI.toast('บันทึกไม่สำเร็จ: ' + err.message, 'error'); }
}

// =====================================================================
//  ENTRANTS (รายชื่อผู้เข้าแข่งขัน)
// =====================================================================
const getEntrants = game => (state[game].players || '').split('\n').map(x => x.trim()).filter(Boolean);
const setEntrants = (game, list) => { state[game].players = [...new Set(list)].join('\n'); };

function renderEntrants(game) {
  const names = getEntrants(game);
  const container = $('selected-list-' + game);
  $('entrant-count-' + game).textContent = names.length ? `(${names.length})` : '';
  container.innerHTML = names.length === 0
    ? `<span class="selected-empty">ยังไม่มีผู้เข้าแข่งขัน… เลือกจากกล่องด้านบน</span>`
    : names.map((name, idx) => `<div class="selected-item">${escapeHTML(name)}
        <button type="button" class="remove" data-remove="${idx}" aria-label="นำ ${escapeHTML(name)} ออก">&times;</button></div>`).join('');

  // ตัวเลือกจากโปรไฟล์ (เฉพาะที่ยังไม่ได้เลือก)
  const sel = $('profilePicker-' + game);
  const type = GAME_META[game].entrant;
  const items = Object.values(state.profiles)
    .filter(p => p.game === game && p.type === type && !names.includes(p.name.trim()))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));
  const placeholder = type === 'player' ? '👤 เลือกผู้เล่น…' : '🛡️ เลือกทีม…';
  sel.innerHTML = `<option value="">— ${items.length ? placeholder : 'ไม่มีโปรไฟล์ที่ยังไม่ได้เลือก'} —</option>` +
    items.map(p => `<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)}${p.team && type === 'player' ? ' • ' + escapeHTML(p.team) : ''}</option>`).join('');

  // แจ้งเตือนเมื่อรายชื่อไม่ตรงกับสายแข่ง/ตารางที่สร้างไว้
  const built = game === 'ff' ? state.ff.teamsData.map(t => t.name)
    : (state[game].tournament[0] || []).flatMap(m => [m.p1, m.p2]).filter(n => n !== BYE && n !== EMPTY);
  const stale = built.length > 0 && (built.length !== names.length || built.some(n => !names.includes(n)));
  $('stale-hint-' + game).hidden = !stale;
}

function addProfileToGame(game, id) {
  if (!isAdmin() || !id) return;
  const p = state.profiles[id]; if (!p) return;
  setEntrants(game, [...getEntrants(game), p.name.trim()]);
  saveGame(game);
}

function removeEntrant(game, idx) {
  if (!isAdmin()) return;
  const names = getEntrants(game); names.splice(idx, 1);
  setEntrants(game, names);
  saveGame(game);
}

async function confirmReset(gameId) {
  if (!isAdmin()) return;
  const ok = await UI.confirm({ title: '⚠️ ล้างข้อมูล', message: `ล้างรายชื่อและผลการแข่งขันทั้งหมดของ ${GAME_META[gameId].label}? ย้อนกลับไม่ได้`, okText: 'ล้างข้อมูล', danger: true });
  if (!ok) return;
  state[gameId] = gameId === 'ff' ? { teamsData: [], players: '' } : { tournament: [], players: '' };
  saveGame(gameId);
}

// =====================================================================
//  BRACKET ENGINE (eFootball / RoV)
// =====================================================================
const hasStarted = t => t.some(r => r.some(m => m.s1 > 0 || m.s2 > 0));
const isReal = n => n && n !== EMPTY && n !== BYE;

async function generateBracket(gameId) {
  if (!isAdmin()) return;
  const players = getEntrants(gameId);
  if (players.length < 2) return UI.toast('ต้องมีผู้เข้าแข่งขันอย่างน้อย 2 คน/ทีม', 'error');
  if (hasStarted(state[gameId].tournament)) {
    const ok = await UI.confirm({ title: 'สร้างสายแข่งใหม่?', message: 'สายแข่งปัจจุบันมีการลงคะแนนแล้ว การสุ่มใหม่จะลบผลทั้งหมด', okText: 'สุ่มสายใหม่', danger: true });
    if (!ok) return;
  }
  for (let i = players.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [players[i], players[j]] = [players[j], players[i]]; }

  let size = 2; while (size < players.length) size *= 2;
  const slots = new Array(size).fill(null);
  // กระจาย BYE ไปทั้งสองฝั่งของสาย
  const matchOrder = []; let left = 0, right = size / 2 - 1;
  while (left <= right) { matchOrder.push(left); if (left !== right) matchOrder.push(right); left++; right--; }
  for (let i = 0; i < size - players.length; i++) slots[matchOrder[i] * 2 + 1] = BYE;
  let p = 0; for (let i = 0; i < size; i++) if (!slots[i]) slots[i] = players[p++];

  const tournament = [];
  const r1 = [];
  for (let i = 0; i < size; i += 2) {
    const m = { p1: slots[i], p2: slots[i + 1], s1: 0, s2: 0, winner: null, loser: null };
    if (m.p2 === BYE) { m.winner = m.p1; m.loser = BYE; }
    r1.push(m);
  }
  tournament.push(r1);
  for (let r = 1; r < Math.log2(size); r++) {
    tournament.push(Array.from({ length: tournament[r - 1].length / 2 }, () => ({ p1: EMPTY, p2: EMPTY, s1: 0, s2: 0, winner: null, loser: null })));
  }
  state[gameId].tournament = tournament;
  r1.forEach((m, idx) => { if (m.winner) pushWinner(gameId, 0, idx, m.winner); });
  saveGame(gameId);
}

function pushWinner(gameId, rIdx, mIdx, name) {
  const next = state[gameId].tournament[rIdx + 1]?.[Math.floor(mIdx / 2)];
  if (next) next[mIdx % 2 === 0 ? 'p1' : 'p2'] = name;
}

function changeScore(gameId, rIdx, mIdx, slot, delta) {
  if (!isAdmin()) return;
  const m = state[gameId].tournament[rIdx]?.[mIdx];
  if (!m || m.winner || !isReal(m.p1) || !isReal(m.p2)) return;
  const key = slot === 1 ? 's1' : 's2';
  m[key] = Math.max(0, Math.min(2, m[key] + delta));
  if (m.s1 >= 2) { m.winner = m.p1; m.loser = m.p2; }
  else if (m.s2 >= 2) { m.winner = m.p2; m.loser = m.p1; }
  if (m.winner) pushWinner(gameId, rIdx, mIdx, m.winner);
  saveGame(gameId);
}

// ยกเลิกผลแมตช์ที่ตัดสินไปแล้ว (เช่น กดคะแนนผิด) — ทำได้เมื่อแมตช์ถัดไปยังไม่เริ่ม
function resetMatch(gameId, rIdx, mIdx) {
  if (!isAdmin()) return;
  const t = state[gameId].tournament; const m = t[rIdx]?.[mIdx];
  if (!m || !isReal(m.p1) || !isReal(m.p2)) return;
  const next = t[rIdx + 1]?.[Math.floor(mIdx / 2)];
  if (next && (next.s1 > 0 || next.s2 > 0 || next.winner)) {
    return UI.toast('แมตช์ถัดไปเริ่มลงคะแนนแล้ว ต้องรีเซ็ตแมตช์นั้นก่อน', 'error');
  }
  Object.assign(m, { s1: 0, s2: 0, winner: null, loser: null });
  if (next) next[mIdx % 2 === 0 ? 'p1' : 'p2'] = EMPTY;
  saveGame(gameId);
}

function renderBracket(gameId) {
  const t = state[gameId].tournament;
  const wrapper = $(`wrapper-${gameId}`);
  // แสดงแอนิเมชันเฉพาะครั้งแรก ไม่ให้สายแข่งกระพริบทุกครั้งที่กดคะแนน
  const firstPaint = !wrapper.querySelector('.round-column');
  wrapper.classList.toggle('static', !firstPaint);
  wrapper.querySelectorAll('.round-column, .bracket-empty').forEach(el => el.remove());
  if (!t.length) {
    wrapper.insertAdjacentHTML('beforeend', `<div class="bracket-empty">${loaded ? (isAdmin() ? 'ยังไม่ได้สร้างสายแข่ง — เลือกผู้เข้าแข่งขันแล้วกด "สร้างสายแข่ง"' : 'ยังไม่ได้สร้างสายแข่ง') : 'กำลังโหลดข้อมูล…'}</div>`);
    $(`svg-${gameId}`).innerHTML = '';
    renderPodium(gameId);
    return;
  }
  const admin = isAdmin();
  t.forEach((round, rIdx) => {
    const col = document.createElement('div'); col.className = 'round-column';
    const title = rIdx === t.length - 1 ? '🏆 ชิงเหรียญทอง (BO3)' : rIdx === t.length - 2 ? 'รอบรองชนะเลิศ (BO3)' : `รอบที่ ${rIdx + 1} (BO3)`;
    let html = `<div class="round-header">${title}</div>`;
    round.forEach((m, mIdx) => {
      const playable = isReal(m.p1) && isReal(m.p2);
      const canReset = admin && playable && (m.winner || m.s1 > 0 || m.s2 > 0);
      html += `<div class="match-box${m.winner ? ' done' : ''}${playable && !m.winner ? ' live' : ''}" id="match-${gameId}-${rIdx}-${mIdx}">
        <div class="match-meta"><span>Match ${mIdx + 1}</span>
          ${canReset ? `<button type="button" class="match-reset" data-reset="${rIdx},${mIdx}" title="ยกเลิกผลแมตช์นี้">↺ รีเซ็ต</button>` : '<span>BO3</span>'}</div>
        ${slotHTML(m, 1, rIdx, mIdx, playable, admin)}${slotHTML(m, 2, rIdx, mIdx, playable, admin)}
      </div>`;
    });
    col.innerHTML = html;
    wrapper.appendChild(col);
  });
  requestAnimationFrame(() => renderLines(gameId));
  renderPodium(gameId);
}

function slotHTML(m, slot, rIdx, mIdx, playable, admin) {
  const name = slot === 1 ? m.p1 : m.p2, score = slot === 1 ? m.s1 : m.s2;
  if (name === EMPTY) return `<div class="slot empty">รอผู้ชนะ</div>`;
  if (name === BYE) return `<div class="slot bye">${BYE}</div>`;
  const won = m.winner === name, editable = admin && playable && !m.winner;
  const ref = `${rIdx},${mIdx},${slot}`;
  return `<div class="slot${won ? ' won' : ''}${m.winner && !won ? ' lost' : ''}">
    <span class="slot-name">${escapeHTML(name)}</span>
    <div class="score-badge">
      ${editable && score > 0 ? `<button type="button" class="lens score-btn minus" data-score="${ref},-1" aria-label="ลดคะแนน ${escapeHTML(name)}">−</button>` : ''}
      <span class="score-num">${playable ? score : ''}</span>
      ${editable ? `<button type="button" class="lens score-btn" data-score="${ref},1" aria-label="เพิ่มคะแนน ${escapeHTML(name)}">+</button>` : ''}
    </div></div>`;
}

function renderPodium(gameId) {
  const t = state[gameId].tournament;
  const final = t.length ? t[t.length - 1][0] : null;
  const podium = $(`podium-${gameId}`);
  if (!final || !final.winner) { podium.style.display = 'none'; return; }
  const bronze = t.length >= 2 ? t[t.length - 2].map(m => m.loser).filter(isReal) : [];
  $(`gold-${gameId}`).textContent = final.winner;
  $(`silver-${gameId}`).textContent = isReal(final.loser) ? final.loser : '-';
  $(`bronze-${gameId}`).textContent = bronze.length ? bronze.join(', ') : '-';
  podium.style.display = 'block';
}

function renderLines(gameId) {
  const t = state[gameId].tournament; const svg = $(`svg-${gameId}`); const wrapper = $(`wrapper-${gameId}`);
  if (!svg || !wrapper) return; svg.innerHTML = '';
  if (!t.length || !wrapper.offsetParent) return;
  // ให้ SVG กว้างเท่าเนื้อหาทั้งหมด (รวมส่วนที่ต้องเลื่อนดู) เส้นจะได้ไม่ถูกตัด
  svg.style.width = '0'; svg.style.height = '0';
  svg.style.width = wrapper.scrollWidth + 'px'; svg.style.height = wrapper.scrollHeight + 'px';
  // ใช้ตำแหน่ง layout (offset) แทน getBoundingClientRect เพราะไม่โดน transform
  // ของแอนิเมชัน/hover รบกวน เส้นจึงตรงกับกล่องเสมอ
  const box = el => {
    let x = 0, y = 0, n = el;
    while (n && n !== wrapper) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
    return { left: x, top: y, right: x + el.offsetWidth, height: el.offsetHeight };
  };
  for (let r = 0; r < t.length - 1; r++) {
    for (let m = 0; m < t[r].length; m++) {
      const el1 = $(`match-${gameId}-${r}-${m}`), el2 = $(`match-${gameId}-${r + 1}-${Math.floor(m / 2)}`);
      if (!el1 || !el2) continue;
      const a = box(el1), b = box(el2);
      const sx = a.right, sy = a.top + a.height / 2;
      const ex = b.left, ey = b.top + b.height * (m % 2 === 0 ? 0.3 : 0.7);
      const mx = sx + (ex - sx) / 2, rad = 10;
      let d = `M ${sx} ${sy} `;
      if (Math.abs(sy - ey) > 12) {
        const dir = sy < ey ? 1 : -1;
        d += `L ${mx - rad} ${sy} Q ${mx} ${sy} ${mx} ${sy + rad * dir} L ${mx} ${ey - rad * dir} Q ${mx} ${ey} ${mx + rad} ${ey} `;
      } else d += `L ${mx} ${sy} L ${mx} ${ey} `;
      d += `L ${ex} ${ey}`;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d); path.setAttribute('class', 'tree-line' + (t[r][m].winner ? ' active' : ''));
      svg.appendChild(path);
    }
  }
}

// =====================================================================
//  FREE FIRE ENGINE
// =====================================================================
const FF_FIELDS = ['m1R', 'm1K', 'm2R', 'm2K', 'm3R', 'm3K'];

async function generateFFTable() {
  if (!isAdmin()) return;
  const names = getEntrants('ff');
  if (!names.length) return UI.toast('กรุณาเลือกทีมก่อน', 'error');
  const old = Object.fromEntries(state.ff.teamsData.map(t => [t.name, t]));
  const dropped = state.ff.teamsData.filter(t => !names.includes(t.name) && FF_FIELDS.some(f => t[f] !== ''));
  if (dropped.length) {
    const ok = await UI.confirm({ title: 'อัปเดตตาราง?', message: `ทีมที่ถูกนำออก (${dropped.map(t => t.name).join(', ')}) มีคะแนนอยู่แล้ว คะแนนของทีมเหล่านี้จะหายไป`, okText: 'อัปเดต', danger: true });
    if (!ok) return;
  }
  // เก็บคะแนนเดิมของทีมที่ยังอยู่ไว้
  state.ff.teamsData = names.map(name => old[name] || { name, m1R: '', m1K: '', m2R: '', m2K: '', m3R: '', m3K: '', booyah: 0, kills: 0, pts: 0 });
  calculateFFScores();
  saveGame('ff');
}

function calculateFFScores() {
  state.ff.teamsData.forEach(t => {
    let pts = 0, booyah = 0, kills = 0;
    [1, 2, 3].forEach(n => {
      const r = parseInt(t[`m${n}R`], 10), k = parseInt(t[`m${n}K`], 10) || 0;
      if (r === 1) booyah++;
      pts += (FF_POINTS[r] || 0) + k; kills += k;
    });
    Object.assign(t, { booyah, kills, pts });
  });
}

// อันดับ: คะแนนรวม > จำนวน Booyah > Kill รวม > อันดับแมตช์สุดท้าย
function rankedFF() {
  return [...state.ff.teamsData].sort((a, b) =>
    b.pts - a.pts || b.booyah - a.booyah || b.kills - a.kills ||
    (parseInt(a.m3R, 10) || 999) - (parseInt(b.m3R, 10) || 999));
}

function updateFFData(name, field, raw) {
  if (!isAdmin()) return;
  const team = state.ff.teamsData.find(t => t.name === name);
  if (!team || !FF_FIELDS.includes(field)) return;
  const isRank = field.endsWith('R');
  let value = String(raw).trim();
  if (value !== '') {
    const n = Number(value);
    const max = isRank ? FF_MAX_RANK : FF_MAX_KILLS;
    if (!Number.isInteger(n) || n < (isRank ? 1 : 0) || n > max) {
      UI.toast(isRank ? `อันดับต้องเป็นเลข 1–${FF_MAX_RANK}` : `Kill ต้องเป็นเลข 0–${FF_MAX_KILLS}`, 'error');
      renderFFTable();
      return;
    }
    value = String(n);
  }
  team[field] = value;
  calculateFFScores();
  saveGame('ff');
}

function renderFFTable() {
  const tbody = $('tbody-ff');
  const admin = isAdmin();
  // จำช่องที่กำลังพิมพ์อยู่ เพื่อไม่ให้ cursor หลุดเมื่อข้อมูลอัปเดตแบบเรียลไทม์
  const focused = document.activeElement?.closest?.('#tbody-ff') ? document.activeElement.dataset : null;
  const focusKey = focused ? `${focused.team}|${focused.field}` : null;

  const ranked = rankedFF();
  const rankOf = new Map(ranked.map((t, i) => [t.name, i + 1]));
  // กรรมการเห็นลำดับตามที่ลงทะเบียน (แถวไม่กระโดดระหว่างกรอก) ผู้ชมเห็นตามอันดับ
  const rows = admin ? state.ff.teamsData : ranked;

  // อันดับซ้ำในแมตช์เดียวกัน
  const dup = {};
  [1, 2, 3].forEach(n => {
    const seen = {};
    state.ff.teamsData.forEach(t => { const r = t[`m${n}R`]; if (r !== '') seen[r] = (seen[r] || 0) + 1; });
    dup[n] = seen;
  });

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="table-empty">${loaded ? 'ยังไม่ได้สร้างตารางคะแนน' : 'กำลังโหลดข้อมูล…'}</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(t => {
      const rank = rankOf.get(t.name);
      const cell = (n, kind) => {
        const field = `m${n}${kind}`, v = t[field];
        const isDup = kind === 'R' && v !== '' && dup[n][v] > 1;
        return `<td><input type="number" inputmode="numeric" min="${kind === 'R' ? 1 : 0}" value="${escapeHTML(v)}"
          data-team="${escapeHTML(t.name)}" data-field="${field}" aria-label="${escapeHTML(t.name)} แมตช์ ${n} ${kind === 'R' ? 'อันดับ' : 'Kills'}"
          class="${isDup ? 'dup' : ''}" title="${isDup ? 'อันดับซ้ำกับทีมอื่นในแมตช์นี้' : ''}" ${admin ? '' : 'disabled'}></td>`;
      };
      return `<tr class="${rank <= 3 && t.pts > 0 ? 'top' + rank : ''}">
        <td><b class="rank-num">#${rank}</b></td>
        <td class="team-name">${escapeHTML(t.name)}</td>
        ${cell(1, 'R')}${cell(1, 'K')}${cell(2, 'R')}${cell(2, 'K')}${cell(3, 'R')}${cell(3, 'K')}
        <td>${t.booyah > 0 ? `<span class="booyah-badge">${t.booyah}</span>` : '0'}</td>
        <td>${t.kills}</td><td class="total-pts">${t.pts}</td></tr>`;
    }).join('');
  }
  if (focusKey) {
    const el = [...tbody.querySelectorAll('input')].find(i => `${i.dataset.team}|${i.dataset.field}` === focusKey);
    if (el) el.focus();
  }

  const podium = $('podium-ff');
  if (ranked.some(t => t.pts > 0)) {
    const medal = (i, color) => ranked[i] ? `${escapeHTML(ranked[i].name)}<br><span class="medal-pts" style="color:${color}">${ranked[i].pts} PTS</span>` : '-';
    $('gold-ff').innerHTML = medal(0, 'var(--primary)');
    $('silver-ff').innerHTML = medal(1, '#a1aab3');
    $('bronze-ff').innerHTML = medal(2, '#cd7f32');
    podium.style.display = 'block';
  } else podium.style.display = 'none';
}

// =====================================================================
//  PROFILES
// =====================================================================
function avatarHTML(p) {
  const url = processImageUrl(p.avatar);
  const fallback = p.type === 'team' ? '🛡️' : '👤';
  return url ? `<img src="${escapeHTML(url)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(document.createTextNode('${fallback}'))">` : fallback;
}

function renderProfiles() {
  const pGrid = $('playerGrid'), tGrid = $('teamGrid');
  if (!loaded) {
    const sk = '<div class="profile-card skeleton"></div>'.repeat(4);
    pGrid.innerHTML = sk; tGrid.innerHTML = sk; return;
  }
  const q = $('profileSearch').value.trim().toLowerCase();
  const g = $('profileFilter').value;
  const list = Object.values(state.profiles)
    .filter(p => (!g || p.game === g) && (!q || [p.name, p.team, p.members].some(v => (v || '').toLowerCase().includes(q))))
    .sort((a, b) => a.name.localeCompare(b.name, 'th'));
  const card = (p, i) => `<button type="button" class="profile-card" style="animation-delay:${Math.min(i * 40, 400)}ms" data-profile-id="${escapeHTML(p.id)}">
      <div class="profile-avatar">${avatarHTML(p)}</div>
      <div>
        <div class="profile-name">${escapeHTML(p.name)}</div>
        <div class="profile-sub">${p.type === 'team' ? '🛡️ ทีม' : '👤 ผู้เล่น'} • ${escapeHTML(GAME_META[p.game]?.label || '')}${p.team && p.type === 'player' ? ' • ' + escapeHTML(p.team) : ''}</div>
      </div>
    </button>`;
  const players = list.filter(p => p.type === 'player'), teams = list.filter(p => p.type === 'team');
  const empty = what => `<div class="profile-empty">${q || g ? 'ไม่พบ' + what + 'ที่ตรงกับการค้นหา' : 'ยังไม่มีข้อมูล' + what + 'ในระบบ'}</div>`;
  pGrid.innerHTML = players.map(card).join('') || empty('ผู้เล่น');
  tGrid.innerHTML = teams.map(card).join('') || empty('ทีม');
  $('playerCount').textContent = players.length;
  $('teamCount').textContent = teams.length;
}

function openPlayerForm(id = null) {
  if (!isAdmin()) return;
  const p = id && state.profiles[id];
  $('playerForm').reset();
  $('playerId').value = p ? id : '';
  $('playerFormTitle').textContent = p ? '✏️ แก้ไขข้อมูลผู้เล่น' : '👤 เพิ่มผู้เล่นใหม่';
  if (p) {
    $('playerGame').value = p.game; $('playerName').value = p.name; $('playerRealName').value = p.realname;
    $('playerRole').value = p.role; $('playerTeam').value = p.team; $('playerAvatar').value = p.avatar; $('playerBio').value = p.bio;
  }
  refreshTeamSuggestions();
  UI.openModal('playerFormModal');
}

function openTeamForm(id = null) {
  if (!isAdmin()) return;
  const p = id && state.profiles[id];
  $('teamForm').reset();
  $('teamId').value = p ? id : '';
  $('teamFormTitle').textContent = p ? '✏️ แก้ไขข้อมูลทีม' : '🛡️ เพิ่มทีมใหม่';
  if (p) {
    $('teamGame').value = p.game; $('teamName').value = p.name; $('teamRealName').value = p.realname;
    $('teamMembers').value = p.members; $('teamAvatar').value = p.avatar; $('teamBio').value = p.bio;
  }
  UI.openModal('teamFormModal');
}

function refreshTeamSuggestions() {
  $('teamSuggestions').innerHTML = Object.values(state.profiles).filter(p => p.type === 'team')
    .map(p => `<option value="${escapeHTML(p.name)}">`).join('');
}

const submitPlayer = e => submitProfile(e, 'player');
const submitTeam = e => submitProfile(e, 'team');

async function submitProfile(e, type) {
  e.preventDefault();
  if (!isAdmin()) return;
  const v = id => $(id).value.trim();
  const pre = type === 'player' ? 'player' : 'team';
  const existingId = v(pre + 'Id');
  const profile = StoreUtils.normalizeProfile(existingId, {
    id: existingId || (type === 'player' ? 'p_' : 't_') + Date.now(),
    type, game: v(pre + 'Game'), name: v(pre + 'Name'), realname: v(pre + 'RealName'), avatar: v(pre + 'Avatar'), bio: v(pre + 'Bio'),
    ...(type === 'player' ? { role: v('playerRole'), team: v('playerTeam') } : { members: $('teamMembers').value.trim() })
  });
  if (!profile.name) return UI.toast('กรุณากรอกชื่อ', 'error');
  const clash = Object.values(state.profiles).find(p => p.id !== profile.id && p.type === type && p.game === profile.game && p.name.trim().toLowerCase() === profile.name.toLowerCase());
  if (clash) return UI.toast(`มี${type === 'player' ? 'ผู้เล่น' : 'ทีม'}ชื่อ "${profile.name}" ในเกมนี้แล้ว`, 'error');
  if (profile.avatar && !processImageUrl(profile.avatar)) return UI.toast('ลิงก์รูปต้องขึ้นต้นด้วย http:// หรือ https://', 'error');

  const old = existingId && state.profiles[existingId];
  const btn = e.submitter; if (btn) btn.disabled = true;
  try {
    await store.saveProfile(profile);
    state.profiles[profile.id] = profile;
    // เปลี่ยนชื่อ -> อัปเดตชื่อในรายชื่อแข่ง/สายแข่ง/ตารางคะแนนด้วย
    if (old && old.name !== profile.name) {
      if (renameEverywhere(old.game, old.name, profile.name)) await store.saveGame(old.game, state[old.game]);
      if (type === 'team') {
        const affected = Object.values(state.profiles).filter(p => p.type === 'player' && p.team === old.name);
        for (const p of affected) { p.team = profile.name; await store.saveProfile(p); }
      }
    }
    UI.closeModal(type === 'player' ? 'playerFormModal' : 'teamFormModal');
    UI.toast('💾 บันทึกโปรไฟล์แล้ว');
    render();
  } catch (err) {
    UI.toast('บันทึกไม่สำเร็จ: ' + err.message, 'error');
  } finally { if (btn) btn.disabled = false; }
}

function renameEverywhere(game, oldName, newName) {
  let changed = false;
  const swap = n => (n === oldName ? (changed = true, newName) : n);
  setEntrants(game, getEntrants(game).map(swap));
  if (game === 'ff') state.ff.teamsData.forEach(t => { t.name = swap(t.name); });
  else state[game].tournament.forEach(r => r.forEach(m => ['p1', 'p2', 'winner', 'loser'].forEach(k => { m[k] = swap(m[k]); })));
  return changed;
}

function openProfileDetail(id) {
  const p = state.profiles[id]; if (!p) return;
  const admin = isAdmin();
  const section = (title, cls, body) => `<div class="detail-section"><div class="detail-section-title ${cls}">${title}</div>${body}</div>`;
  let extra = '';

  if (p.type === 'team') {
    const linked = Object.values(state.profiles).filter(x => x.type === 'player' && x.team.trim() === p.name.trim());
    if (linked.length) extra += section('👤 สมาชิกในทีม', 'primary', `<div class="member-grid">${linked.map(lp => `
      <button type="button" class="member-tag linked" data-profile-id="${escapeHTML(lp.id)}">
        <span class="member-avatar">${avatarHTML(lp)}</span><span class="member-name">${escapeHTML(lp.name)}</span>
      </button>`).join('')}</div>`);
    const others = p.members.split('\n').map(m => m.trim()).filter(Boolean);
    if (others.length) extra += section('📋 รายชื่อสมาชิกเสริม', 'secondary', `<div class="member-list">${others.map(m => `<span class="member-tag">${escapeHTML(m)}</span>`).join('')}</div>`);
  }

  const row = (icon, html) => `<div class="detail-row"><span class="detail-icon">${icon}</span><span>${html}</span></div>`;
  let info = p.team ? row('🛡️', `สังกัด: <b class="accent">${escapeHTML(p.team)}</b>`) : '';
  if (admin) {
    if (p.realname) info += row('👤', escapeHTML(p.realname));
    if (p.role) info += row('🎯', `ตำแหน่ง: <b>${escapeHTML(p.role)}</b>`);
    if (p.bio) info += `<div class="detail-bio">${escapeHTML(p.bio).replace(/\n/g, '<br>')}</div>`;
  } else if (p.realname || p.role || p.bio) {
    info += `<div class="detail-locked">🔒 ข้อมูลเชิงลึกสงวนสิทธิ์เฉพาะคณะกรรมการ</div>`;
  }

  $('profileDetailContent').innerHTML = `
    <div class="profile-detail-head">
      <div class="profile-avatar">${avatarHTML(p)}</div>
      <div class="profile-detail-meta">
        <h3 id="profileDetailTitle">${escapeHTML(p.name)}</h3>
        <p>${p.type === 'team' ? '🛡️ Team' : '👤 Player'} <span class="muted">|</span> ${escapeHTML(GAME_META[p.game]?.label || '')}</p>
      </div>
    </div>
    <div class="detail-info">${info}</div>
    ${extra}
    ${admin ? `<div class="detail-actions">
      <button type="button" class="lens grow" data-edit-profile="${escapeHTML(p.id)}">✏️ แก้ไขข้อมูล</button>
      <button type="button" class="lens lens-danger" data-delete-profile="${escapeHTML(p.id)}">🗑️ ลบ</button>
    </div>` : ''}`;
  UI.openModal('profileDetailModal');
}

async function deleteProfile(id) {
  if (!isAdmin()) return;
  const p = state.profiles[id]; if (!p) return;
  const inUse = getEntrants(p.game).includes(p.name);
  const ok = await UI.confirm({
    title: '🗑️ ลบโปรไฟล์', danger: true, okText: 'ลบ',
    message: `ลบ "${p.name}" ออกจากฐานข้อมูลถาวร?` + (inUse ? ' (ชื่อนี้ยังอยู่ในรายชื่อแข่งขัน จะยังแสดงในสายแข่ง/ตารางเดิม)' : '')
  });
  if (!ok) return;
  try {
    await store.deleteProfile(id);
    delete state.profiles[id];
    UI.closeModal('profileDetailModal');
    UI.toast('ลบโปรไฟล์แล้ว', 'info');
    render();
  } catch (err) { UI.toast('ลบไม่สำเร็จ: ' + err.message, 'error'); }
}

// =====================================================================
//  RULES / EXPORT
// =====================================================================
function openRulesModal(gameId) {
  $('modalTitle').textContent = GAME_META[gameId].rulesTitle;
  $('modalContent').innerHTML = RULES[gameId];
  UI.openModal('rulesModal');
}

function exportData() {
  if (!isAdmin()) return;
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), backend: store.name, data: state }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `dbc-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// =====================================================================
//  EVENTS
// =====================================================================
function bindStaticEvents() {
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-score],[data-reset],[data-remove],[data-profile-id],[data-edit-profile],[data-delete-profile]');
    if (!t) return;
    const d = t.dataset;
    if (d.score) { const [r, m, s, delta] = d.score.split(',').map(Number); changeScore(currentGame, r, m, s, delta); }
    else if (d.reset) { const [r, m] = d.reset.split(',').map(Number); resetMatch(currentGame, r, m); }
    else if (d.remove !== undefined) removeEntrant(currentGame, Number(d.remove));
    else if (d.editProfile) { const p = state.profiles[d.editProfile]; UI.closeModal('profileDetailModal'); p.type === 'player' ? openPlayerForm(p.id) : openTeamForm(p.id); }
    else if (d.deleteProfile) deleteProfile(d.deleteProfile);
    else if (d.profileId) { UI.closeModal('profileDetailModal'); openProfileDetail(d.profileId); }
  });
  $('tbody-ff').addEventListener('change', e => {
    const i = e.target; if (i.dataset.field) updateFFData(i.dataset.team, i.dataset.field, i.value);
  });
  $('profileSearch').addEventListener('input', renderProfiles);
  $('profileFilter').addEventListener('change', renderProfiles);
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (currentGame && currentGame !== 'ff') renderLines(currentGame); }, 100);
  });
}
