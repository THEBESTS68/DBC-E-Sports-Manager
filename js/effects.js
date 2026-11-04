(() => {
  // High-Performance Ripple Effect
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest('.btn-primary, .profile-btn, .btn-auth, .btn-back, .score-btn, .btn-full-rules, .btn-reset');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'ripple';
    const size = Math.max(r.width, r.height) * 1.5;
    dot.style.width = dot.style.height = size + 'px';
    dot.style.left = (e.clientX - r.left - size/2) + 'px';
    dot.style.top = (e.clientY - r.top - size/2) + 'px';
    el.appendChild(dot);
    setTimeout(() => dot.remove(), 600);
  });

  // 3D Hover Tilt (Optimized with requestAnimationFrame)
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    let ticking = false;
    document.addEventListener('mousemove', e => {
      const card = e.target.closest('.game-card');
      if (!card) return;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const r = card.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width - 0.5;
          const y = (e.clientY - r.top) / r.height - 0.5;
          card.style.transform = `translateY(-15px) perspective(1000px) rotateX(${-y * 12}deg) rotateY(${x * 12}deg) scale(1.02)`;
          ticking = false;
        });
        ticking = true;
      }
    });
    document.addEventListener('mouseout', e => {
      const card = e.target.closest('.game-card');
      if (card && !card.contains(e.relatedTarget)) {
        card.style.transform = '';
      }
    });
  }

  // การ์ดที่เป็น role="button" กด Enter / Space ได้ (Esc ปิด modal อยู่ใน ui.js)
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[role="button"]')) {
      e.preventDefault();
      e.target.click();
    }
  });
})();
