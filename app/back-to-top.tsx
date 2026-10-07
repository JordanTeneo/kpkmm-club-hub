'use client';

import {useEffect, useState} from 'react';

export function BackToTop({label}: {label: string}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > 300);
    update();
    window.addEventListener('scroll', update, {passive: true});
    return () => window.removeEventListener('scroll', update);
  }, []);

  function scrollToTop() {
    document.getElementById('page-top')?.focus({preventScroll: true});
    window.scrollTo({top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }

  return <button type="button" className="back-to-top" hidden={!visible} onClick={scrollToTop} aria-label={label} title={label}>
    <span aria-hidden="true">↑</span><span>{label}</span>
  </button>;
}
