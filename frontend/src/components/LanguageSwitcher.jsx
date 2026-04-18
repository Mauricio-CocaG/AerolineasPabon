import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';

const LANGS = [
  { code: 'es', label: 'Español',    flag: '🇪🇸', short: 'ES' },
  { code: 'en', label: 'English',    flag: '🇬🇧', short: 'EN' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷', short: 'FR' },
  { code: 'pt', label: 'Português',  flag: '🇧🇷', short: 'PT' },
  { code: 'ja', label: '日本語',     flag: '🇯🇵', short: 'JA' },
];

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current  = i18n.language?.split('-')[0];
  const active   = LANGS.find(l => l.code === current) || LANGS[0];

  const [open, setOpen]       = useState(false);
  const [leaving, setLeaving] = useState(false);

  const dropRef      = useRef(null);
  const itemsRef     = useRef([]);
  const chevronRef   = useRef(null);
  const containerRef = useRef(null);

  /* ── close on outside click ── */
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closeMenu();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── open animation ── */
  const openMenu = () => {
    if (open || leaving) return;
    setOpen(true);
  };

  useEffect(() => {
    if (!open || !dropRef.current) return;
    const items = itemsRef.current.filter(Boolean);

    // Dropdown container
    gsap.fromTo(dropRef.current,
      { opacity: 0, scaleY: 0.5, scaleX: 0.92, transformOrigin: 'top right', y: -6 },
      { opacity: 1, scaleY: 1,   scaleX: 1,    duration: 0.28, ease: 'back.out(1.6)', y: 0 }
    );

    // Items stagger in
    gsap.fromTo(items,
      { opacity: 0, x: 10 },
      { opacity: 1, x: 0, duration: 0.22, stagger: 0.04, ease: 'power3.out', delay: 0.06 }
    );

    // Chevron rotates down
    if (chevronRef.current) {
      gsap.to(chevronRef.current, { rotation: 180, duration: 0.25, ease: 'power2.inOut' });
    }
  }, [open]);

  /* ── close animation ── */
  const closeMenu = useCallback(() => {
    if (!open || leaving) return;
    setLeaving(true);

    const items = itemsRef.current.filter(Boolean);

    // Chevron back up
    if (chevronRef.current) {
      gsap.to(chevronRef.current, { rotation: 0, duration: 0.2, ease: 'power2.inOut' });
    }

    gsap.to(items, {
      opacity: 0, x: 6, duration: 0.14, stagger: { each: 0.03, from: 'end' }, ease: 'power2.in',
    });

    gsap.to(dropRef.current, {
      opacity: 0, scaleY: 0.6, scaleX: 0.94, y: -4,
      transformOrigin: 'top right',
      duration: 0.22, ease: 'power2.in',
      delay: 0.08,
      onComplete: () => { setOpen(false); setLeaving(false); },
    });
  }, [open, leaving]);

  /* ── select a language ── */
  const handleSelect = (code, idx) => {
    if (code === current) { closeMenu(); return; }

    const item = itemsRef.current[idx];
    if (item) {
      const tl = gsap.timeline();
      tl.to(item, { scale: 0.92, duration: 0.07, ease: 'power2.in' })
        .to(item, { scale: 1.04, background: 'rgba(75,130,255,0.35)', duration: 0.1, ease: 'back.out(2)' })
        .to(item, { scale: 1,    background: 'transparent', duration: 0.18, ease: 'power2.out' });
    }

    setTimeout(() => {
      // Let App.jsx handle the actual language change with its transition
      window.dispatchEvent(new CustomEvent('lang-will-change', { detail: { code } }));
      closeMenu();
    }, 180);
  };

  /* ── trigger button pulse on open ── */
  const handleToggle = () => {
    if (open || leaving) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>

      {/* ── Trigger button ── */}
      <button
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: open ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
          border: `1px solid ${open ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.14)'}`,
          borderRadius: '10px',
          padding: '5px 10px 5px 8px',
          cursor: 'pointer',
          color: '#fff',
          fontFamily: 'inherit',
          fontSize: '.72rem',
          fontWeight: 600,
          letterSpacing: '.04em',
          transition: 'background 0.18s, border-color 0.18s',
          minWidth: '72px',
        }}
      >
        <span style={{ fontSize: '.9rem', lineHeight: 1 }}>{active.flag}</span>
        <span style={{ flex: 1, textAlign: 'left' }}>{active.short}</span>
        <svg
          ref={chevronRef}
          width="10" height="10"
          viewBox="0 0 10 10"
          fill="none"
          style={{ flexShrink: 0, transformOrigin: '50% 50%' }}
        >
          <path d="M2 3.5L5 6.5L8 3.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          ref={dropRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            minWidth: '148px',
            background: 'linear-gradient(160deg, rgba(10,18,50,0.96) 0%, rgba(6,8,24,0.98) 100%)',
            border: '1px solid rgba(75,130,255,0.22)',
            borderRadius: '14px',
            padding: '6px',
            boxShadow: '0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(75,130,255,0.08)',
            zIndex: 9999,
            backdropFilter: 'blur(18px)',
            overflow: 'hidden',
          }}
        >
          {/* Glow orb */}
          <div style={{
            position: 'absolute', top: '-20px', left: '50%', transform: 'translateX(-50%)',
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(75,130,255,.2) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {LANGS.map(({ code, label, flag, short }, idx) => {
            const isCurrent = code === current;
            return (
              <div
                key={code}
                ref={el => itemsRef.current[idx] = el}
                onClick={() => handleSelect(code, idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 10px',
                  borderRadius: '9px',
                  cursor: 'pointer',
                  background: isCurrent ? 'rgba(75,130,255,0.18)' : 'transparent',
                  border: isCurrent ? '1px solid rgba(75,130,255,0.3)' : '1px solid transparent',
                  marginBottom: idx < LANGS.length - 1 ? '2px' : 0,
                  transition: 'background 0.15s',
                  position: 'relative',
                }}
                onMouseEnter={e => {
                  if (!isCurrent) gsap.to(e.currentTarget, { background: 'rgba(255,255,255,0.06)', duration: 0.15 });
                }}
                onMouseLeave={e => {
                  if (!isCurrent) gsap.to(e.currentTarget, { background: 'transparent', duration: 0.2 });
                }}
              >
                <span style={{ fontSize: '1.05rem', lineHeight: 1, flexShrink: 0 }}>{flag}</span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: '.78rem',
                    fontWeight: isCurrent ? 700 : 500,
                    color: isCurrent ? '#fff' : 'rgba(255,255,255,0.75)',
                    fontFamily: 'inherit',
                    lineHeight: 1.2,
                  }}>
                    {label}
                  </div>
                  <div style={{
                    fontSize: '.6rem',
                    color: isCurrent ? 'rgba(75,130,255,0.9)' : 'rgba(255,255,255,0.3)',
                    fontWeight: 600,
                    letterSpacing: '.08em',
                    marginTop: '1px',
                  }}>
                    {short}
                  </div>
                </div>
                {isCurrent && (
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: 'var(--blue)', boxShadow: '0 0 6px rgba(75,130,255,0.8)',
                    flexShrink: 0,
                  }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
