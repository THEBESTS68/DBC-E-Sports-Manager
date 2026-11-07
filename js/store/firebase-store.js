// Firebase Realtime Database adapter (ระบบเดิม ใช้ระหว่างรอย้ายไป Supabase)
// หมายเหตุ: โหมดนี้ตรวจรหัสกรรมการในเบราว์เซอร์เท่านั้น ฐานข้อมูลยังไม่ได้ป้องกันการเขียนจริง
window.createFirebaseStore = function (cfg) {
  firebase.initializeApp(cfg);
  const db = firebase.database();
  const root = db.ref(cfg.rootPath);
  const SESSION_KEY = 'dbc_admin';
  let admin = sessionStorage.getItem(SESSION_KEY) === 'true';
  const authListeners = [];

  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function setAdmin(v) {
    admin = v;
    if (v) sessionStorage.setItem(SESSION_KEY, 'true'); else sessionStorage.removeItem(SESSION_KEY);
    authListeners.forEach(cb => cb(v));
  }

  return {
    name: 'firebase',
    async init() {},
    subscribe(cb) {
      root.on('value', snap => cb(StoreUtils.normalizeState(snap.val())));
    },
    onConnection(cb) {
      db.ref('.info/connected').on('value', snap => cb(snap.val() === true));
    },
    saveGame(gameId, data) {
      return root.child(gameId).set(data);
    },
    saveProfile(profile) {
      return root.child('profiles').child(profile.id).set(profile);
    },
    deleteProfile(id) {
      return root.child('profiles').child(id).remove();
    },
    auth: {
      kind: 'passcode',
      async login({ passcode }) {
        const ok = (await sha256(passcode || '')) === cfg.adminPasscodeSha256;
        if (ok) setAdmin(true);
        return ok ? { ok } : { ok, message: 'รหัสผ่านไม่ถูกต้อง' };
      },
      async logout() { setAdmin(false); },
      isAdmin() { return admin; },
      onChange(cb) { authListeners.push(cb); }
    }
  };
};
