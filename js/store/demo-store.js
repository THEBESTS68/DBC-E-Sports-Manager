// Demo adapter — ข้อมูลอยู่ในหน่วยความจำของเบราว์เซอร์เท่านั้น ไม่เขียนลงฐานข้อมูลจริง
// เปิดใช้ด้วย ?backend=demo (เฉพาะ localhost) เพื่อทดสอบ/ซ้อมใช้งาน
// ดึงข้อมูลตั้งต้นจาก Firebase แบบอ่านอย่างเดียวหนึ่งครั้ง
window.createDemoStore = function (cfg) {
  let data = StoreUtils.normalizeState(null);
  let admin = false;
  const listeners = [], authListeners = [];
  const emit = () => { const s = StoreUtils.normalizeState(JSON.parse(JSON.stringify(data))); listeners.forEach(cb => cb(s)); };
  const later = () => new Promise(r => setTimeout(r, 120));

  return {
    name: 'demo',
    async init() {
      try {
        const res = await fetch(`${cfg.databaseURL}/${cfg.rootPath}.json`);
        if (res.ok) data = StoreUtils.normalizeState(await res.json());
      } catch { /* เริ่มจากข้อมูลว่าง */ }
      UI.toast('โหมด DEMO: การแก้ไขจะไม่ถูกบันทึกลงฐานข้อมูลจริง', 'info');
    },
    subscribe(cb) { listeners.push(cb); emit(); },
    onConnection(cb) { cb(true); },
    async saveGame(id, g) { await later(); data[id] = JSON.parse(JSON.stringify(g)); emit(); },
    async saveProfile(p) { await later(); data.profiles[p.id] = { ...p }; emit(); },
    async deleteProfile(id) { await later(); delete data.profiles[id]; emit(); },
    auth: {
      kind: 'passcode',
      async login({ passcode }) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(passcode || ''));
        const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
        admin = hex === cfg.adminPasscodeSha256;
        authListeners.forEach(f => f(admin));
        return admin;
      },
      async logout() { admin = false; authListeners.forEach(f => f(false)); },
      isAdmin() { return admin; },
      onChange(cb) { authListeners.push(cb); }
    }
  };
};
