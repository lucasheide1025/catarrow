(() => {
  const links = window.CAT_ARCHERY || {};
  document.querySelectorAll('[data-link]').forEach(link => {
    const url = links[link.dataset.link];
    if (url) link.href = url;
  });
  const menu = document.querySelector('[data-menu]');
  const nav = document.querySelector('[data-nav]');
  menu?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menu.setAttribute('aria-expanded', String(open));
    menu.textContent = open ? '×' : '☰';
  });
  nav?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    nav.classList.remove('open');
    menu?.setAttribute('aria-expanded', 'false');
    if (menu) menu.textContent = '☰';
  }));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveals = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('in'));
  } else {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      observer.unobserve(entry.target);
    }), { threshold: .12 });
    reveals.forEach(el => observer.observe(el));
  }
  const footer = document.querySelector('footer');
  const mobileBook = document.querySelector('.mobile-book');
  if (footer && mobileBook && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => mobileBook.classList.toggle('hide', entry.isIntersecting), { threshold: .08 }).observe(footer);
  }
})();
