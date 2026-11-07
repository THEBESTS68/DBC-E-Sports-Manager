// Demo adapter — ข้อมูลอยู่ในหน่วยความจำของเบราว์เซอร์เท่านั้น ไม่เขียนลงฐานข้อมูลจริง
// เปิดใช้ด้วย ?backend=demo (เฉพาะ localhost) เพื่อทดสอบ/ซ้อมใช้งาน
// ดึงข้อมูลตั้งต้นจาก Firebase แบบอ่านอย่างเดียวหนึ่งครั้ง และจำลองระบบลงทะเบียน/สมัครกรรมการ
window.createDemoStore = function (cfg) {
  let data = StoreUtils.normalizeState(null);
  let registrations = [], adminRequests = [];
  let admin = false;
  const listeners = [], authListeners = [];
  const clone = v => JSON.parse(JSON.stringify(v));
  const emit = () => {
    const s = StoreUtils.normalizeState(clone(data));
    s.registrations = admin ? clone(registrations.filter(r => r.status === 'pending')) : [];
    s.adminRequests = admin ? clone(adminRequests.filter(r => r.status === 'pending')) : [];
    listeners.forEach(cb => cb(s));
  };
  const later = () => new Promise(r => setTimeout(r, 150));
  const setAdmin = v => { admin = v; authListeners.forEach(f => f(v)); emit(); };
  async function sha256(t) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t || ''));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  return {
    name: 'demo',
    supportsRegistration: true,
    async init() {
      try {
        const res = await fetch(`${cfg.databaseURL}/${cfg.rootPath}.json`);
        if (res.ok) data = StoreUtils.normalizeState(await res.json());
      } catch { /* เริ่มจากข้อมูลว่าง */ }
      // ตัวอย่างคำขอ เพื่อให้เห็นหน้าตาแผงอนุมัติ
      registrations.push({ id: 'demo-r1', kind: 'player', game: 'ef', name: 'DemoStriker', realname: 'สมชาย ทดสอบ', student_id: '6845440xxxx', team: '', role: 'FW', members: '', contact: 'line: demo', avatar: '', bio: 'ตัวอย่างคำขอ', status: 'pending', created_at: new Date().toISOString() });
      adminRequests.push({ user_id: 'demo-u1', display_name: 'กรรมการตัวอย่าง', email: 'referee@example.com', status: 'pending', created_at: new Date().toISOString() });
      UI.toast('โหมด DEMO: การแก้ไขจะไม่ถูกบันทึกลงฐานข้อมูลจริง', 'info');
    },
    subscribe(cb) { listeners.push(cb); emit(); },
    onConnection(cb) { cb(true); },
    async saveGame(id, g) { await later(); data[id] = clone(g); emit(); },
    async saveProfile(p) { await later(); data.profiles[p.id] = { ...p }; emit(); },
    async deleteProfile(id) { await later(); delete data.profiles[id]; emit(); },

    async submitRegistration(reg) {
      await later();
      registrations.push({ ...clone(reg), id: 'demo-' + Date.now(), status: 'pending', created_at: new Date().toISOString() });
      emit();
    },
    async approveRegistration(id) {
      await later();
      const r = registrations.find(x => x.id === id && x.status === 'pending');
      if (!r) throw new Error('คำขอนี้ไม่ได้รออนุมัติแล้ว');
      if (Object.values(data.profiles).some(p => p.type === r.kind && p.game === r.game && p.name.trim().toLowerCase() === r.name.trim().toLowerCase())) {
        throw new Error(`มีโปรไฟล์ชื่อ "${r.name}" ในเกมนี้แล้ว`);
      }
      const pid = (r.kind === 'team' ? 't_' : 'p_') + Date.now();
      data.profiles[pid] = StoreUtils.normalizeProfile(pid, { ...r, id: pid, type: r.kind });
      r.status = 'approved'; emit();
    },
    async rejectRegistration(id) {
      await later();
      const r = registrations.find(x => x.id === id); if (r) r.status = 'rejected'; emit();
    },
    async reviewAdminRequest(userId, approve) {
      await later();
      const r = adminRequests.find(x => x.user_id === userId && x.status === 'pending');
      if (!r) throw new Error('คำขอนี้ไม่ได้รออนุมัติแล้ว');
      r.status = approve ? 'approved' : 'rejected'; emit();
    },

    auth: {
      kind: 'passcode',
      canSignUp: true,
      async login({ passcode }) {
        const ok = (await sha256(passcode)) === cfg.adminPasscodeSha256;
        if (ok) setAdmin(true);
        return ok ? { ok } : { ok, message: 'รหัสผ่านไม่ถูกต้อง' };
      },
      async signUp({ name, email }) {
        await later();
        if (adminRequests.some(r => r.email === email)) throw new Error('อีเมลนี้สมัครไว้แล้ว');
        adminRequests.push({ user_id: 'demo-' + Date.now(), display_name: name, email, status: 'pending', created_at: new Date().toISOString() });
        emit();
        return { needsConfirm: true };
      },
      async logout() { setAdmin(false); },
      isAdmin() { return admin; },
      onChange(cb) { authListeners.push(cb); }
    }
  };
};
