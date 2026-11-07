// =====================================================================
//  ลงทะเบียนนักกีฬา • เข้าสู่ระบบ/สมัครกรรมการ • แผงอนุมัติคำขอ
// =====================================================================
const GAME_OPTIONS = {
  player: [['ef', '⚽ eFootball'], ['rov', '⚔️ Garena RoV'], ['ff', '🪂 Free Fire']],
  team: [['rov', '⚔️ Garena RoV'], ['ff', '🪂 Free Fire']]
};

// ---------------------------------------------------------------------
//  ลงทะเบียนนักกีฬา (สาธารณะ)
// ---------------------------------------------------------------------
function openRegister() {
  if (!store) return UI.toast('ยังเชื่อมต่อฐานข้อมูลไม่สำเร็จ', 'error');
  if (!store.supportsRegistration) return UI.toast('ระบบลงทะเบียนต้องใช้ฐานข้อมูล Supabase', 'error');
  const form = $('registerForm');
  form.reset();
  form.hidden = false;
  $('registerDone').hidden = true;
  form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
  syncRegisterForm();
  $('regTeamList').innerHTML = Object.values(state.profiles).filter(p => p.type === 'team')
    .map(p => `<option value="${escapeHTML(p.name)}">`).join('');
  if (!$('registerModal').classList.contains('active')) UI.openModal('registerModal');
  else $('regName').focus();
}

function syncRegisterForm() {
  const form = $('registerForm');
  const kind = form.elements.kind.value;
  form.dataset.kind = kind;
  const sel = $('regGame'), prev = sel.value;
  sel.innerHTML = GAME_OPTIONS[kind].map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  if (GAME_OPTIONS[kind].some(([v]) => v === prev)) sel.value = prev;
  $('regNameLabel').textContent = kind === 'team' ? 'ชื่อทีม *' : 'ชื่อในเกม (IGN) *';
  $('regRealLabel').textContent = kind === 'team' ? 'ชื่อ-นามสกุลกัปตันทีม *' : 'ชื่อ-นามสกุลจริง *';
  $('regMembers').required = kind === 'team';
}

async function submitRegistration(e) {
  e.preventDefault();
  const form = e.target;
  if (form.elements.website.value) return; // honeypot — บอทกรอกช่องที่มองไม่เห็น
  const v = n => (form.elements[n].value || '').trim();
  const kind = form.elements.kind.value;
  const reg = {
    kind, game: v('game'), name: v('name'), realname: v('realname'), student_id: v('student_id'),
    team: kind === 'player' ? v('team') : '', role: kind === 'player' ? v('role') : '',
    members: kind === 'team' ? form.elements.members.value.trim() : '',
    contact: v('contact'), avatar: v('avatar'), bio: form.elements.bio.value.trim()
  };

  // ตรวจข้อมูลและไฮไลต์ช่องที่ผิด
  const errors = [];
  const bad = (el, msg) => { el.classList.add('invalid'); errors.push(msg); };
  form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
  if (!reg.name) bad(form.elements['name'], kind === 'team' ? 'กรุณากรอกชื่อทีม' : 'กรุณากรอกชื่อในเกม');
  if (!reg.realname) bad(form.elements.realname, 'กรุณากรอกชื่อ-นามสกุล');
  if (kind === 'team' && !reg.members) bad(form.elements.members, 'กรุณากรอกรายชื่อสมาชิก');
  if (!reg.contact) bad(form.elements.contact, 'กรุณากรอกช่องทางติดต่อ');
  if (reg.avatar && !processImageUrl(reg.avatar)) bad(form.elements.avatar, 'ลิงก์รูปต้องขึ้นต้นด้วย https://');
  if (!$('regConsent').checked) bad($('regConsent').closest('.consent'), 'กรุณายืนยันการให้ข้อมูล');
  const taken = Object.values(state.profiles).some(p => p.type === kind && p.game === reg.game && p.name.trim().toLowerCase() === reg.name.toLowerCase());
  if (reg.name && taken) bad(form.elements['name'], `ชื่อ "${reg.name}" มีในระบบแล้ว`);
  if (errors.length) { UI.toast(errors[0], 'error'); form.querySelector('.invalid input, .invalid, input.invalid')?.focus?.(); return; }

  const btn = e.submitter; if (btn) btn.disabled = true;
  try {
    await store.submitRegistration(reg);
    form.hidden = true;
    $('registerDone').hidden = false;
  } catch (err) {
    UI.toast('ส่งไม่สำเร็จ: ' + err.message, 'error');
  } finally { if (btn) btn.disabled = false; }
}

// ---------------------------------------------------------------------
//  กรรมการ: เข้าสู่ระบบ / สมัคร
// ---------------------------------------------------------------------
function openAuth(tab = 'login') {
  const passcode = store.auth.kind !== 'email';
  $('authModal').dataset.mode = passcode ? 'passcode' : 'email';
  $('authTabs').hidden = !store.auth.canSignUp;
  ['loginForm', 'signupForm'].forEach(id => $(id).reset());
  ['loginError', 'signupError'].forEach(id => { $(id).hidden = true; });
  // เปิด required ให้ตรงกับโหมดที่ใช้
  $('loginEmail').required = $('loginPassword').required = !passcode;
  $('loginPasscode').required = passcode;
  switchAuthTab(tab);
  UI.openModal('authModal');
}

function switchAuthTab(tab) {
  $('authTabs').querySelectorAll('[data-auth-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.authTab === tab)));
  $('loginForm').hidden = tab !== 'login';
  $('signupForm').hidden = tab !== 'signup';
  $('signupDone').hidden = true;
  setTimeout(() => (tab === 'login' ? $('loginForm') : $('signupForm')).querySelector('input:not([hidden])')?.focus(), 60);
}

function showFormError(id, msg) { const el = $(id); el.textContent = msg; el.hidden = !msg; }

async function submitLogin(e) {
  e.preventDefault();
  const f = e.target, btn = e.submitter;
  const creds = store.auth.kind === 'email'
    ? { email: f.elements.email.value.trim(), password: f.elements.password.value }
    : { passcode: f.elements.passcode.value };
  if (btn) btn.disabled = true;
  showFormError('loginError', '');
  try {
    const res = await store.auth.login(creds);
    if (!res.ok) return showFormError('loginError', res.message || 'เข้าสู่ระบบไม่สำเร็จ');
    UI.closeModal('authModal');
    UI.toast('เข้าสู่ระบบกรรมการแล้ว');
    render();
  } catch (err) {
    showFormError('loginError', err.message);
  } finally { if (btn) btn.disabled = false; }
}

async function submitSignup(e) {
  e.preventDefault();
  const f = e.target, btn = e.submitter;
  const name = f.elements['name'].value.trim(), email = f.elements.email.value.trim(), password = f.elements.password.value;
  if (!name || !email) return showFormError('signupError', 'กรุณากรอกชื่อและอีเมล');
  if (password.length < 8) return showFormError('signupError', 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร');
  if (btn) btn.disabled = true;
  showFormError('signupError', '');
  try {
    const { needsConfirm } = await store.auth.signUp({ name, email, password });
    f.hidden = true;
    $('signupDone').hidden = false;
    $('signupDoneText').textContent = needsConfirm
      ? `ส่งลิงก์ยืนยันไปที่ ${email} แล้ว กดยืนยันในอีเมล จากนั้นรอกรรมการที่มีอยู่อนุมัติ`
      : 'รอกรรมการที่มีอยู่อนุมัติ แล้วจึงเข้าสู่ระบบได้';
  } catch (err) {
    showFormError('signupError', err.message);
  } finally { if (btn) btn.disabled = false; }
}

// ---------------------------------------------------------------------
//  แผงอนุมัติคำขอ (กรรมการ)
// ---------------------------------------------------------------------
const GAME_LABEL = { ef: 'eFootball', rov: 'Garena RoV', ff: 'Free Fire' };
const timeAgo = iso => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'เมื่อสักครู่';
  if (s < 3600) return `${Math.floor(s / 60)} นาทีที่แล้ว`;
  if (s < 86400) return `${Math.floor(s / 3600)} ชม.ที่แล้ว`;
  return `${Math.floor(s / 86400)} วันที่แล้ว`;
};

function renderReviewPanel() {
  const panel = $('reviewPanel');
  const regs = state.registrations || [], refs = state.adminRequests || [];
  const show = isAdmin() && !currentGame && !!store?.supportsRegistration;
  panel.hidden = !show;
  const total = regs.length + refs.length;
  // ป้ายแจ้งเตือนบนปุ่มออกจากระบบ
  const authBtn = $('authContainer').querySelector('button');
  if (authBtn && isAdmin() && total) authBtn.insertAdjacentHTML('beforeend', `<span class="dot-badge">${total}</span>`);
  if (!show) return;
  $('reviewCount').textContent = total;
  $('reviewCount').classList.toggle('zero', total === 0);

  const row = (label, value) => value ? `<div><dt>${label}</dt><dd>${escapeHTML(value).replace(/\n/g, '<br>')}</dd></div>` : '';
  $('regList').innerHTML = regs.length ? regs.map(r => `
    <article class="review-item glass-inset">
      <div class="review-top">
        <span class="chip ${r.game}">${GAME_LABEL[r.game] || r.game}</span>
        <span class="chip">${r.kind === 'team' ? '🛡️ ทีม' : '👤 ผู้เล่น'}</span>
        <span class="muted small">${timeAgo(r.created_at)}</span>
      </div>
      <div class="review-name">${escapeHTML(r.name)}</div>
      <dl class="review-data">
        ${row(r.kind === 'team' ? 'กัปตัน' : 'ชื่อจริง', r.realname)}
        ${row('รหัสนักศึกษา', r.student_id)}
        ${row('ติดต่อ', r.contact)}
        ${row('สังกัด', r.team)}
        ${row('ตำแหน่ง', r.role)}
        ${row('สมาชิก', r.members)}
        ${row('ข้อความ', r.bio)}
      </dl>
      <div class="review-actions">
        <button type="button" class="lens lens-sm lens-danger" data-reg-reject="${escapeHTML(r.id)}">ปฏิเสธ</button>
        <button type="button" class="lens lens-sm lens-primary" data-reg-approve="${escapeHTML(r.id)}">✓ อนุมัติ</button>
      </div>
    </article>`).join('') : '<div class="review-empty">ไม่มีคำขอค้าง</div>';

  $('refList').innerHTML = refs.length ? refs.map(r => `
    <article class="review-item glass-inset">
      <div class="review-top"><span class="chip">🧑‍⚖️ กรรมการ</span><span class="muted small">${timeAgo(r.created_at)}</span></div>
      <div class="review-name">${escapeHTML(r.display_name || '(ไม่ระบุชื่อ)')}</div>
      <dl class="review-data">${row('อีเมล', r.email)}</dl>
      <div class="review-actions">
        <button type="button" class="lens lens-sm lens-danger" data-ref-reject="${escapeHTML(r.user_id)}">ปฏิเสธ</button>
        <button type="button" class="lens lens-sm lens-primary" data-ref-approve="${escapeHTML(r.user_id)}">✓ อนุมัติ</button>
      </div>
    </article>`).join('') : '<div class="review-empty">ไม่มีคำขอค้าง</div>';
}

async function reviewAction(btn, fn, okMsg) {
  btn.disabled = true;
  btn.closest('.review-item')?.classList.add('busy');
  try { await fn(); UI.toast(okMsg); render(); }
  catch (err) { UI.toast(err.message, 'error'); btn.disabled = false; btn.closest('.review-item')?.classList.remove('busy'); }
}

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-auth-tab],[data-reg-approve],[data-reg-reject],[data-ref-approve],[data-ref-reject]');
  if (!t) return;
  const d = t.dataset;
  if (d.authTab) return switchAuthTab(d.authTab);
  if (!isAdmin()) return;
  if (d.regApprove) {
    const r = state.registrations.find(x => x.id === d.regApprove);
    return reviewAction(t, () => store.approveRegistration(d.regApprove), `อนุมัติ "${r?.name}" แล้ว — สร้างโปรไฟล์ให้เรียบร้อย`);
  }
  if (d.regReject) {
    const r = state.registrations.find(x => x.id === d.regReject);
    const ok = await UI.confirm({ title: 'ปฏิเสธคำขอ?', message: `ปฏิเสธการลงทะเบียนของ "${r?.name}"?`, okText: 'ปฏิเสธ', danger: true });
    if (ok) reviewAction(t, () => store.rejectRegistration(d.regReject), 'ปฏิเสธคำขอแล้ว');
    return;
  }
  if (d.refApprove) {
    const r = state.adminRequests.find(x => x.user_id === d.refApprove);
    const ok = await UI.confirm({ title: 'อนุมัติกรรมการ?', message: `${r?.display_name || ''} (${r?.email}) จะแก้ไขข้อมูลการแข่งขันทั้งหมดได้`, okText: 'อนุมัติ' });
    if (ok) reviewAction(t, () => store.reviewAdminRequest(d.refApprove, true), 'เพิ่มกรรมการแล้ว');
    return;
  }
  if (d.refReject) reviewAction(t, () => store.reviewAdminRequest(d.refReject, false), 'ปฏิเสธคำขอแล้ว');
});
