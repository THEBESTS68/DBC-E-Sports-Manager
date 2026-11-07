// =====================================================================
//  เอฟเฟกต์ Liquid Glass
// =====================================================================
(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // การหักเหแสงผ่าน SVG filter ใช้ได้ดีเฉพาะ Chromium (Chrome / Edge / Brave)
  // Safari / Firefox ยังแสดงเป็นกระจกฝ้าปกติ
  const isChromium = !!(navigator.userAgentData && navigator.userAgentData.brands?.some(b => /Chromium/i.test(b.brand)));
  // (การหักเหเป็นภาพนิ่ง ไม่ใช่การเคลื่อนไหว จึงไม่ปิดตาม prefers-reduced-motion)
  if (isChromium) document.documentElement.classList.add('lens-fx');

  // ไฮไลต์เลนส์เคลื่อนตามตำแหน่งนิ้ว/เมาส์
  document.addEventListener('pointermove', e => {
    const el = e.target.closest?.('.lens');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
    el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
  }, { passive: true });
  document.addEventListener('pointerout', e => {
    const el = e.target.closest?.('.lens');
    if (el && !el.contains(e.relatedTarget)) { el.style.removeProperty('--mx'); el.style.removeProperty('--my'); }
  });

  // คลื่นแสงเมื่อกดปุ่ม
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest('.lens');
    if (!el || reduceMotion) return;
    const r = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 1.4;
    const dot = document.createElement('span');
    dot.className = 'ripple';
    Object.assign(dot.style, { width: size + 'px', height: size + 'px', left: (e.clientX - r.left - size / 2) + 'px', top: (e.clientY - r.top - size / 2) + 'px' });
    el.appendChild(dot);
    setTimeout(() => dot.remove(), 600);
  });

  // การ์ดเกมเอียงตามเมาส์เล็กน้อย
  if (finePointer && !reduceMotion) {
    let raf = 0;
    document.addEventListener('mousemove', e => {
      const card = e.target.closest('.game-card');
      if (!card || raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = `perspective(1100px) translateY(-6px) rotateX(${(-y * 6).toFixed(2)}deg) rotateY(${(x * 6).toFixed(2)}deg)`;
      });
    });
    document.addEventListener('mouseout', e => {
      const card = e.target.closest('.game-card');
      if (card && !card.contains(e.relatedTarget)) card.style.transform = '';
    });
  }

  // การ์ดที่เป็น role="button" กด Enter / Space ได้ (Esc ปิด modal อยู่ใน ui.js)
  document.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[role="button"]')) {
      e.preventDefault();
      e.target.click();
    }
  });
})();
