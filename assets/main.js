// assets/main.js
(function(){
  const docEl = document.documentElement;
  const header = document.querySelector('.site-header');
  const navToggle = document.querySelector('.nav-toggle');
  const siteNav = document.getElementById('site-nav');
  const motionToggle = document.getElementById('motionToggle');
  const contrastToggle = document.getElementById('contrastToggle');

  // Year
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  // Sticky header shrink
  const onScroll = () => { 
    if (window.scrollY > 10) header.classList.add('shrink');
    else header.classList.remove('shrink');
  };
  window.addEventListener('scroll', onScroll, {passive:true});
  onScroll();

  // Mobile nav
  navToggle?.addEventListener('click', () => {
    const open = siteNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  siteNav?.addEventListener('click', (e) => {
    if (e.target.matches('a[href^="#"]')) siteNav.classList.remove('open');
  });

  // Motion preference init
  const mediaReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const storedReduce = localStorage.getItem('cc_reduce_motion');
  const storedContrast = localStorage.getItem('cc_contrast_high');

  const applyMotionPref = () => {
    const reduce = (storedReduce === 'true') || mediaReduce.matches;
    docEl.setAttribute('data-reduce-motion', reduce ? 'true' : 'false');
    if (motionToggle) motionToggle.checked = reduce;
  };
  applyMotionPref();
  mediaReduce.addEventListener?.('change', applyMotionPref);

  // Contrast toggle
  const setContrast = (on) => {
    if (on) docEl.classList.add('contrast-high');
    else docEl.classList.remove('contrast-high');
    if (contrastToggle) contrastToggle.checked = on;
  };
  setContrast(storedContrast === 'true');

  motionToggle?.addEventListener('change', (e)=>{
    const reduce = e.target.checked;
    localStorage.setItem('cc_reduce_motion', reduce ? 'true' : 'false');
    applyMotionPref();
  });
  contrastToggle?.addEventListener('change', (e)=>{
    const on = e.target.checked;
    localStorage.setItem('cc_contrast_high', on ? 'true' : 'false');
    setContrast(on);
  });

  // Parallax (mouse)
  const parallaxRoot = document.querySelector('[data-parallax-container]');
  let rafId = null;
  function parallaxHandler(e){
    if (docEl.getAttribute('data-reduce-motion') === 'true') return;
    const rect = parallaxRoot.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    const layers = parallaxRoot.querySelectorAll('.layer');
    layers.forEach(layer=>{
      const depth = parseFloat(layer.getAttribute('data-depth') || '0.1');
  const max = 10; // px (reduced for subtler parallax)
      const tx = Math.max(Math.min(-x * depth * max, max), -max);
      const ty = Math.max(Math.min(-y * depth * max, max), -max);
      layer.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    });
  }
  function onMove(e){
    if (!parallaxRoot) return;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(()=>parallaxHandler(e));
  }
  if (parallaxRoot){
    window.addEventListener('mousemove', onMove);
  }

  // Disable animations immediately if reduced
  if (docEl.getAttribute('data-reduce-motion') === 'true'){
    document.querySelectorAll('.layer').forEach(el => el.style.transform = 'none');
  }

  // Mailto helper
  const form = document.getElementById('contactForm');
  form?.addEventListener('submit', (e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    const name = (fd.get('name')||'').toString().trim();
    const email = (fd.get('email')||'').toString().trim();
    const subjRaw = (fd.get('subject')||'').toString().trim() || 'Message from Website';
    const msg = (fd.get('message')||'').toString().trim();

    const subject = `${subjRaw}${name ? ' — ' + name : ''}`;
    const lines = [
      msg,
      '',
      '— —',
      `From: ${name || '(no name provided)'}`,
      `Email: ${email || '(no email provided)'}`
    ].join('\n');
    const href = `mailto:hello@corbettscastle.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines)}`;
    window.location.href = href;
  });

  // Anchor focus management for accessibility (bring section into focus)
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click', (e)=>{
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target){
        // Allow CSS smooth scroll unless reduced motion
        if (docEl.getAttribute('data-reduce-motion') === 'true'){ target.scrollIntoView(); }
        target.setAttribute('tabindex','-1');
        target.focus({preventScroll:true});
        setTimeout(()=>target.removeAttribute('tabindex'), 2000);
      }
    });
  });
})();
