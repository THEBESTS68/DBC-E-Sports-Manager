// Supabase adapter
// ตาราง: games, profiles, profile_private, admins (ดู supabase/schema.sql)
// สิทธิ์การเขียนถูกตรวจที่ฐานข้อมูลด้วย Row Level Security ไม่ใช่ในเบราว์เซอร์
window.createSupabaseStore = function (cfg) {
  if (!cfg.url || !cfg.anonKey) throw new Error('ยังไม่ได้ตั้งค่า supabase.url / supabase.anonKey ใน js/config.js');
  const sb = supabase.createClient(cfg.url, cfg.anonKey);
  const PUBLIC_FIELDS = ['id', 'type', 'game', 'name', 'team', 'members', 'avatar'];
  const PRIVATE_FIELDS = ['realname', 'role', 'bio'];

  let admin = false;
  const authListeners = [];
  const stateListeners = [];
  const connListeners = [];
  const cache = { games: {}, profiles: [], privates: [] };

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

  async function fetchGames() {
    const { data, error } = await sb.from('games').select('id, data');
    if (error) throw error;
    cache.games = Object.fromEntries(data.map(r => [r.id, r.data]));
  }
  async function fetchProfiles() {
    const { data, error } = await sb.from('profiles').select(PUBLIC_FIELDS.join(','));
    if (error) throw error;
    cache.profiles = data;
  }
  async function fetchPrivates() {
    if (!admin) { cache.privates = []; return; }
    const { data, error } = await sb.from('profile_private').select('profile_id,' + PRIVATE_FIELDS.join(','));
    if (error) throw error;
    cache.privates = data;
  }

  function emit() {
    const priv = Object.fromEntries(cache.privates.map(p => [p.profile_id, p]));
    const profiles = {};
    cache.profiles.forEach(p => { profiles[p.id] = { ...p, ...(priv[p.id] || {}) }; });
    const state = StoreUtils.normalizeState({ ...cache.games, profiles });
    stateListeners.forEach(cb => cb(state));
  }

  function pick(obj, keys) { return Object.fromEntries(keys.map(k => [k, obj[k] ?? ''])); }

  return {
    name: 'supabase',
    async init() {
      await refreshAdmin();
      await Promise.all([fetchGames(), fetchProfiles(), fetchPrivates()]);
      sb.auth.onAuthStateChange(async () => {
        await refreshAdmin(); await fetchPrivates(); emit();
      });
      sb.channel('dbc-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, async () => { await fetchGames(); emit(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, async () => { await fetchProfiles(); emit(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profile_private' }, async () => { await fetchPrivates(); emit(); })
        .subscribe(status => connListeners.forEach(cb => cb(status === 'SUBSCRIBED')));
    },
    subscribe(cb) { stateListeners.push(cb); emit(); },
    onConnection(cb) { connListeners.push(cb); },
    async saveGame(gameId, data) {
      const { error } = await sb.from('games').upsert({ id: gameId, data, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    async saveProfile(profile) {
      const { error } = await sb.from('profiles').upsert(pick(profile, PUBLIC_FIELDS));
      if (error) throw error;
      const { error: e2 } = await sb.from('profile_private').upsert({ profile_id: profile.id, ...pick(profile, PRIVATE_FIELDS) });
      if (e2) throw e2;
    },
    async deleteProfile(id) {
      const { error } = await sb.from('profiles').delete().eq('id', id); // profile_private ลบตามด้วย on delete cascade
      if (error) throw error;
    },
    auth: {
      kind: 'email',
      async login({ email, password }) {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) return false;
        const ok = await refreshAdmin();
        if (!ok) await sb.auth.signOut(); // ล็อกอินได้แต่ไม่ได้อยู่ในตาราง admins
        return ok;
      },
      async logout() { await sb.auth.signOut(); await refreshAdmin(); },
      isAdmin() { return admin; },
      onChange(cb) { authListeners.push(cb); }
    }
  };
};
