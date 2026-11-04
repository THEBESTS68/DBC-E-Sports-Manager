// =====================================================================
//  DATA STORE
//  ชั้นกลางระหว่างหน้าเว็บกับฐานข้อมูล ทุก backend ต้องมีฟังก์ชันชุดเดียวกัน:
//
//    init()                      -> Promise
//    subscribe(cb(state))        เรียก cb ทุกครั้งที่ข้อมูลเปลี่ยน
//    onConnection(cb(bool))      สถานะการเชื่อมต่อ
//    saveGame(gameId, data)      -> Promise   บันทึกเฉพาะเกมนั้น
//    saveProfile(profile)        -> Promise   บันทึกโปรไฟล์ 1 รายการ
//    deleteProfile(id)           -> Promise
//    auth.kind                   'passcode' | 'email'
//    auth.login(creds)           -> Promise<boolean>
//    auth.logout()               -> Promise
//    auth.isAdmin()              -> boolean
//    auth.onChange(cb(bool))
//
//  state = { ef, rov, ff, profiles }  (ดู normalizeState)
// =====================================================================
(function () {
  const GAME_IDS = ['ef', 'rov', 'ff'];

  // Firebase ตัด array ว่าง/ค่า null ทิ้ง จึงต้องเติมโครงสร้างให้ครบทุกครั้ง
  function normalizeGame(gameId, raw) {
    const g = raw && typeof raw === 'object' ? raw : {};
    const players = typeof g.players === 'string' ? g.players : '';
    if (gameId === 'ff') {
      const teams = Array.isArray(g.teamsData) ? g.teamsData : Object.values(g.teamsData || {});
      return { players, teamsData: teams.filter(Boolean) };
    }
    const rounds = Array.isArray(g.tournament) ? g.tournament : Object.values(g.tournament || {});
    const tournament = rounds.map(r => (Array.isArray(r) ? r : Object.values(r || {})).map(m => ({
      p1: m?.p1 ?? '---', p2: m?.p2 ?? '---',
      s1: Number(m?.s1) || 0, s2: Number(m?.s2) || 0,
      winner: m?.winner ?? null, loser: m?.loser ?? null
    })));
    return { players, tournament };
  }

  function normalizeProfile(id, p) {
    return {
      id: p?.id || id, type: p?.type === 'team' ? 'team' : 'player', game: p?.game || 'ef',
      name: p?.name || '', realname: p?.realname || '', role: p?.role || '', team: p?.team || '',
      members: p?.members || '', avatar: p?.avatar || '', bio: p?.bio || ''
    };
  }

  function normalizeState(raw) {
    const d = raw && typeof raw === 'object' ? raw : {};
    const profiles = {};
    Object.entries(d.profiles || {}).forEach(([id, p]) => { if (p) profiles[id] = normalizeProfile(id, p); });
    return { ef: normalizeGame('ef', d.ef), rov: normalizeGame('rov', d.rov), ff: normalizeGame('ff', d.ff), profiles };
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('โหลดสคริปต์ไม่สำเร็จ: ' + src));
      document.head.appendChild(s);
    });
  }

  async function createStore() {
    const cfg = window.APP_CONFIG;
    const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
    const override = isLocal ? new URLSearchParams(location.search).get('backend') : null;
    const backend = override || cfg.backend;
    if (backend === 'demo') {
      await loadScript('js/store/demo-store.js');
      return window.createDemoStore(cfg.firebase);
    }
    if (backend === 'supabase') {
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js');
      await loadScript('js/store/supabase-store.js');
      return window.createSupabaseStore(cfg.supabase);
    }
    await loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
    await loadScript('https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js');
    await loadScript('js/store/firebase-store.js');
    return window.createFirebaseStore(cfg.firebase);
  }

  window.StoreUtils = { GAME_IDS, normalizeState, normalizeGame, normalizeProfile };
  window.createStore = createStore;
})();
