// =====================================================================
//  UI HELPERS — toast, dialog, modal, escape
// =====================================================================
(function () {
  function escapeHTML(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  }

  // แปลงลิงก์ Google Drive ให้แสดงเป็นรูปได้ และอนุญาตเฉพาะ http(s)
  function processImageUrl(url) {
    if (!url) return '';
    const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && url.includes('drive.google.com')) return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    return /^https?:\/\//i.test(url) ? url : '';
  }

  // ---------- Modal ----------
  let lastFocus = null;
  function openModal(id) {
    lastFocus = document.activeElement;
    const el = document.getElementById(id);
    el.classList.add('active');
    document.body.style.overflow = 'hidden';
    const focusable = el.querySelector('input:not([type=hidden]), select, textarea, button:not(.modal-close)') || el.querySelector('.modal-close');
    setTimeout(() => focusable && focusable.focus(), 50);
  }
  function closeModal(id) {
    const el = document.getElementById(id);
    if (!el || !el.classList.contains('active')) return;
    el.classList.remove('active');
    if (!document.querySelector('.modal-overlay.active')) document.body.style.overflow = '';
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
    el.dispatchEvent(new CustomEvent('modal:closed'));
  }
  // คลิกพื้นหลังหรือปุ่ม × เพื่อปิด
  document.addEventListener('click', e => {
    const overlay = e.target.classList?.contains('modal-overlay') ? e.target : null;
    const closeBtn = e.target.closest?.('.modal-close, [data-close-modal]');
    if (overlay) closeModal(overlay.id);
    else if (closeBtn) closeModal(closeBtn.closest('.modal-overlay').id);
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.modal-overlay.active')].pop();
    if (open) closeModal(open.id);
  });

  // ---------- Toast ----------
  function toast(message, type = 'ok') {
    let wrap = document.getElementById('toastWrap');
    if (!wrap) {
      wrap = document.createElement('div'); wrap.id = 'toastWrap'; wrap.className = 'toast-wrap';
      wrap.setAttribute('role', 'status'); wrap.setAttribute('aria-live', 'polite');
      document.body.appendChild(wrap);
    }
    // ข้อความเดิมที่ยังแสดงอยู่ -> ต่อเวลาแทนการซ้อนกล่องใหม่
    let t = [...wrap.children].find(el => el.textContent === message && !el.classList.contains('leaving'));
    if (!t) {
      t = document.createElement('div');
      t.className = `toast toast-${type}`;
      t.textContent = message;
      wrap.appendChild(t);
    }
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.classList.add('leaving'); setTimeout(() => t.remove(), 300); }, type === 'error' ? 5000 : 2500);
  }

  // ---------- Dialog (แทน alert / confirm / prompt) ----------
  function ensureDialog() {
    let el = document.getElementById('dialogModal');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'dialogModal'; el.className = 'modal-overlay';
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'dialogTitle');
    el.innerHTML = `<div class="modal-content narrow">
      <button class="modal-close" aria-label="ปิด">&times;</button>
      <div class="modal-title" id="dialogTitle"></div>
      <form id="dialogForm" class="dialog-form">
        <div id="dialogBody" class="dialog-body"></div>
        <div id="dialogError" class="dialog-error" hidden></div>
        <div class="dialog-actions">
          <button type="button" class="lens" id="dialogCancel" data-close-modal>ยกเลิก</button>
          <button type="submit" class="lens lens-primary" id="dialogOk">ตกลง</button>
        </div>
      </form>
    </div>`;
    document.body.appendChild(el);
    return el;
  }

  // fields: [{name,label,type,autocomplete}] -> resolve(values) / resolve(null) เมื่อยกเลิก
  // validate(values) -> Promise<string|null>  คืนข้อความ error เพื่อแสดงในกล่องโดยไม่ปิด
  function dialog({ title, message = '', fields = [], okText = 'ตกลง', cancelText = 'ยกเลิก', danger = false, validate = null }) {
    const el = ensureDialog();
    el.querySelector('#dialogTitle').textContent = title;
    const body = el.querySelector('#dialogBody');
    body.innerHTML = (message ? `<p class="dialog-message">${escapeHTML(message)}</p>` : '') +
      fields.map(f => `<label class="dialog-field"><span>${escapeHTML(f.label)}</span>
        <input name="${f.name}" type="${f.type || 'text'}" autocomplete="${f.autocomplete || 'off'}" required></label>`).join('');
    const ok = el.querySelector('#dialogOk');
    ok.textContent = okText; ok.classList.toggle('lens-danger', danger); ok.classList.toggle('lens-primary', !danger); ok.disabled = false;
    el.querySelector('#dialogCancel').textContent = cancelText;
    const err = el.querySelector('#dialogError'); err.hidden = true;

    return new Promise(resolve => {
      let done = false;
      const form = el.querySelector('#dialogForm');
      const finish = v => { if (done) return; done = true; form.onsubmit = null; resolve(v); closeModal('dialogModal'); };
      form.onsubmit = async e => {
        e.preventDefault();
        const values = Object.fromEntries(new FormData(form).entries());
        if (validate) {
          ok.disabled = true; err.hidden = true;
          const msg = await validate(values);
          ok.disabled = false;
          if (msg) { err.textContent = msg; err.hidden = false; return; }
        }
        finish(fields.length ? values : true);
      };
      el.addEventListener('modal:closed', () => { if (!done) { done = true; resolve(null); } }, { once: true });
      openModal('dialogModal');
    });
  }

  const confirmDialog = opts => dialog(opts).then(v => v === true);

  window.UI = { escapeHTML, processImageUrl, openModal, closeModal, toast, dialog, confirm: confirmDialog };
})();
