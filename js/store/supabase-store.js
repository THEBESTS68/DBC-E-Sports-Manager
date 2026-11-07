// Supabase adapter
// ตาราง: games, profiles, profile_private, admins, registrations, admin_requests
// (ดู supabase/schema.sql และ supabase/002_registration.sql)
// สิทธิ์การเขียนถูกตรวจที่ฐานข้อมูลด้วย Row Level Security ไม่ใช่ในเบราว์เซอร์
window.createSupabaseStore = function (cfg) {
  if (!cfg.url || !cfg.anonKey) throw new Error('ยังไม่ได้ตั้งค่า supabase.url / supabase.anonKey ใน js/config.js');
  const sb = supabase.createClient(cfg.url, cfg.anonKey);
  const PUBLIC_FIELDS = ['id', 'type', 'game', 'name', 'team', 'members', 'avatar'];
  const PRIVATE_FIELDS = ['realname', 'role', 'bio'];
  const REG_FIELDS = ['kind', 'game', 'name', 'realname', 'student_id', 'team', 'role', 'members', 'contact', 'avatar', 'bio'];

  let admin = false;
  const authListeners = [];
  const stateListeners = [];
  const connListeners = [];
  const cache = { games: {}, profiles: [], privates: [], registrations: [], adminRequests: [] };

  async function refreshAdmin() {
    const { data: { session } } = await sb.auth.getSession();
    let v = false;
    if (session) {
      const { data } = await sb.rpc('is_admin');
      v = data === true;
    }
    if (v !== admin) { admin = v; authListeners.forEach(cb => cb(v)); }
    return v;
  }

  const must = ({ data, error }) => { if (error) throw error; return data; };
  async function fetchGames() {
    cache.games = Object.fromEntries(must(await sb.from('games').select('id, data')).map(r => [r.id, r.data]));
  }
  async function fetchProfiles() {
    cache.profiles = must(await sb.from('profiles').select(PUBLIC_FIELDS.join(',')));
  }
  async function fetchPrivates() {
    cache.privates = admin ? must(await sb.from('profile_private').select('profile_id,' + PRIVATE_FIELDS.join(','))) : [];
  }
  async function fetchRegistrations() {
    cache.registrations = admin
      ? must(await sb.from('registrations').select('*').eq('status', 'pending').order('created_at', { ascending: true }))
      : [];
  }
  async function fetchAdminRequests() {
    cache.adminRequests = admin
      ? must(await sb.from('admin_requests').select('*').eq('status', 'pending').order('created_at', { ascending: true }))
      : [];
  }
  const fetchAdminData = () => Promise.all([fetchPrivates(), fetchRegistrations(), fetchAdminRequests()]);

  function emit() {
    const priv = Object.fromEntries(cache.privates.map(p => [p.profile_id, p]));
    const profiles = {};
    cache.profiles.forEach(p => { profiles[p.id] = { ...p, ...(priv[p.id] || {}) }; });
    const state = StoreUtils.normalizeState({ ...cache.games, profiles });
    state.registrations = cache.registrations;
    state.adminRequests = cache.adminRequests;
    stateListeners.forEach(cb => cb(state));
  }

  function pick(obj, keys) { return Object.fromEntries(keys.map(k => [k, obj[k] ?? ''])); }
  const thaiError = err => {
    const m = err?.message || String(err);
    if (/Email not confirmed/i.test(m)) return 'ยังไม่ได้ยืนยันอีเมล — เปิดลิงก์ยืนยันในอีเมลก่อน';
    if (/Invalid login credentials/i.test(m)) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
    if (/already registered/i.test(m)) return 'อีเมลนี้สมัครไว้แล้ว';
    if (/Password should be at least/i.test(m)) return 'รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร';
    if (/rate limit/i.test(m)) return 'ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
    return m;
  };

  return {
    name: 'supabase',
    supportsRegistration: true,
    async init() {
      await refreshAdmin();
      await Promise.all([fetchGames(), fetchProfiles(), fetchAdminData()]);
      sb.auth.onAuthStateChange(() => {
        // ห้าม await ใน callback นี้ (supabase-js จะค้าง) — ทำงานต่อแบบ async แยก
        setTimeout(async () => { await refreshAdmin(); await fetchAdminData(); emit(); }, 0);
      });
      const refetch = fn => async () => { await fn(); emit(); };
      sb.channel('dbc-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, refetch(fetchGames))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, refetch(fetchProfiles))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profile_private' }, refetch(fetchPrivates))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, refetch(fetchRegistrations))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_requests' }, refetch(fetchAdminRequests))
        .subscribe(status => connListeners.forEach(cb => cb(status === 'SUBSCRIBED')));
    },
    subscribe(cb) { stateListeners.push(cb); emit(); },
    onConnection(cb) { connListeners.push(cb); },
    async saveGame(gameId, data) {
      must(await sb.from('games').upsert({ id: gameId, data, updated_at: new Date().toISOString() }));
    },
    async saveProfile(profile) {
      must(await sb.from('profiles').upsert(pick(profile, PUBLIC_FIELDS)));
      must(await sb.from('profile_private').upsert({ profile_id: profile.id, ...pick(profile, PRIVATE_FIELDS) }));
    },
    async deleteProfile(id) {
      must(await sb.from('profiles').delete().eq('id', id)); // profile_private ลบตามด้วย on delete cascade
    },

    // ---------- ลงทะเบียน ----------
    async submitRegistration(reg) {
      const { error } = await sb.from('registrations').insert(pick(reg, REG_FIELDS));
      if (error) throw new Error(thaiError(error));
    },
    async approveRegistration(id) {
      const { error } = await sb.rpc('approve_registration', { reg_id: id });
      if (error) throw new Error(thaiError(error));
      await Promise.all([fetchRegistrations(), fetchProfiles(), fetchPrivates()]); emit();
    },
    async rejectRegistration(id) {
      must(await sb.from('registrations').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', id));
      await fetchRegistrations(); emit();
    },
    async reviewAdminRequest(userId, approve) {
      const { error } = await sb.rpc('review_admin_request', { req_user: userId, approve });
      if (error) throw new Error(thaiError(error));
      await fetchAdminRequests(); emit();
    },

    auth: {
      kind: 'email',
      canSignUp: true,
      // คืนค่า { ok, message }
      async login({ email, password }) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return { ok: false, message: thaiError(error) };
        if (await refreshAdmin()) return { ok: true };
        const { data: req } = await sb.from('admin_requests').select('status').maybeSingle();
        await sb.auth.signOut();
        if (req?.status === 'pending') return { ok: false, message: 'บัญชีนี้รอกรรมการที่มีอยู่อนุมัติ' };
        if (req?.status === 'rejected') return { ok: false, message: 'คำขอเป็นกรรมการของบัญชีนี้ถูกปฏิเสธ' };
        return { ok: false, message: 'บัญชีนี้ไม่มีสิทธิ์กรรมการ' };
      },
      // คืนค่า { needsConfirm }
      async signUp({ name, email, password }) {
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: { data: { display_name: name }, emailRedirectTo: location.origin + location.pathname }
        });
        if (error) throw new Error(thaiError(error));
        // Supabase ไม่แจ้ง error เมื่ออีเมลซ้ำ (กันการเดาอีเมล) แต่จะไม่มี identities
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          throw new Error('อีเมลนี้สมัครไว้แล้ว');
        }
        if (data.session) await sb.auth.signOut(); // ยังไม่ใช่กรรมการจนกว่าจะได้รับอนุมัติ
        return { needsConfirm: !data.session };
      },
      async logout() { await sb.auth.signOut(); await refreshAdmin(); },
      isAdmin() { return admin; },
      onChange(cb) { authListeners.push(cb); }
    }
  };
};
