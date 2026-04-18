import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { gsap } from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
gsap.registerPlugin(ScrollToPlugin);
import SeatMap from './components/SeatMap';
import FlightSearch from './components/FlightSearch';
import Dashboard from './components/Dashboard';
import BookingForm from './components/BookingForm';
import LanguageSwitcher from './components/LanguageSwitcher';
import { useGeolocation } from './hooks/useGeolocation';

// Configuración de los 3 nodos
const NODES = {
  1: { name: 'BOGOTÁ', country: 'Colombia', url: 'http://localhost:3001', apiUrl: 'http://localhost:3001/api/v1', lat: 4.7110, lng: -74.0721 },
  2: { name: 'MADRID', country: 'España', url: 'http://localhost:3002', apiUrl: 'http://localhost:3002/api/v1', lat: 40.4168, lng: -3.7038 },
  3: { name: 'TOKIO', country: 'Japón', url: 'http://localhost:3003', apiUrl: 'http://localhost:3003/api/v1', lat: 35.6762, lng: 139.6503 }
};

/* ── Animated canvas background ── */
function BgCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    const particles = [];
    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    // Create particles
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        alpha: Math.random() * 0.5 + 0.1,
      });
    }

    const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const color = isDark() ? '75,130,255' : '23,64,194';
      particles.forEach(p => {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color},${p.alpha})`;
        ctx.fill();
      });
      // Draw connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${color},${0.06 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return null;
}

/* ── Cursor: small dot + falling-star trail ── */
function CursorFollower() {
  const dotRef = useRef(null);

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const dot = dotRef.current;
    if (!dot) return;

    gsap.set(dot, { opacity: 0 });

    let shown = false;
    let lastSpawnX = 0, lastSpawnY = 0;

    const CHARS  = ['✦', '✧', '⋆', '·', '✺', '✴'];
    const COLORS = ['#ffffff', '#93c5fd', '#a78bfa', '#67e8f9', '#4B82FF'];

    const spawnStar = (x, y, burst = false) => {
      const count = burst ? 6 : 1;
      for (let i = 0; i < count; i++) {
        const el = document.createElement('span');
        el.className   = 'cursor-star';
        el.textContent = CHARS[Math.floor(Math.random() * CHARS.length)];
        document.body.appendChild(el);

        const size = burst
          ? Math.random() * 9 + 7
          : Math.random() * 7 + 5;
        const angle = burst ? (i / count) * Math.PI * 2 + Math.random() * 0.6 : 0;
        const speed = burst ? Math.random() * 55 + 30 : 0;
        const vx = burst ? Math.cos(angle) * speed : (Math.random() - 0.5) * 28;
        const vy = burst ? Math.sin(angle) * speed : Math.random() * 22 + 8;
        const dur = burst
          ? Math.random() * 0.25 + 0.45
          : Math.random() * 0.35 + 0.55;

        gsap.set(el, {
          x: x, y: y,
          fontSize: size + 'px',
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          opacity: burst ? Math.random() * 0.3 + 0.7 : Math.random() * 0.45 + 0.55,
          rotation: Math.random() * 360,
        });

        gsap.to(el, {
          x: `+=${vx}`, y: `+=${vy}`,
          opacity: 0,
          scale: 0.1,
          rotation: `+=${(Math.random() - 0.5) * 300}`,
          duration: dur,
          ease: burst ? 'power2.out' : 'power1.out',
          onComplete: () => el.remove(),
        });
      }
    };

    const move = (e) => {
      if (!shown) { gsap.to(dot, { opacity: 1, duration: 0.3 }); shown = true; }
      gsap.set(dot, { x: e.clientX, y: e.clientY });

      const dx   = e.clientX - lastSpawnX;
      const dy   = e.clientY - lastSpawnY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 14) {
        spawnStar(e.clientX, e.clientY, false);
        lastSpawnX = e.clientX;
        lastSpawnY = e.clientY;
      }
    };

    const click = (e) => {
      gsap.timeline()
        .to(dot, { scale: 0.4, duration: 0.08, ease: 'power2.in' })
        .to(dot, { scale: 1,   duration: 0.35, ease: 'back.out(3)' });
      spawnStar(e.clientX, e.clientY, true);
    };

    window.addEventListener('mousemove', move);
    window.addEventListener('click', click);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('click', click);
    };
  }, []);

  return <div ref={dotRef} className="cursor-dot" />;
}

export default function App() {
  const { t, i18n } = useTranslation();
  const geo = useGeolocation();
  const navRef = useRef(null);
  const wrapRef = useRef(null);

  // Estado del nodo seleccionado manualmente
  const [selectedNode, setSelectedNode] = useState(null);
  const [apiUrl, setApiUrl] = useState(geo.apiUrl || 'http://localhost:3001/api/v1');
  const [vectorClock, setVectorClock] = useState(null);

  const [activeTab, setActiveTab] = useState('search');
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [bookingResult, setBookingResult] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  // Dark/Light theme toggle
  const [theme, setTheme] = useState('dark');
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
  };

  // Cambiar de nodo manualmente
  const handleNodeChange = (nodeId) => {
    setSelectedNode(nodeId);
    setApiUrl(NODES[nodeId].apiUrl);
    // Resetear datos al cambiar de nodo
    setSelectedFlight(null);
    setSelectedSeat(null);
    setBookingResult(null);
    setActiveTab('search');
  };

  // Obtener reloj vectorial del nodo actual
  const fetchVectorClock = async () => {
    try {
      const response = await axios.get(`${apiUrl}/vector-clock`);
      setVectorClock(response.data.vectorClock);
    } catch (error) {
      console.error('Error fetching vector clock:', error);
    }
  };

  useEffect(() => {
    if (!geo.loading) {
      fetchDashboard();
      fetchVectorClock();
    }
    // Actualizar cada 5 segundos
    const interval = setInterval(() => {
      if (apiUrl) fetchVectorClock();
    }, 5000);
    return () => clearInterval(interval);
  }, [apiUrl, geo.loading]);

  const fetchDashboard = async () => {
    try {
      const r = await axios.get(apiUrl + '/dashboard/stats');
      setDashboardData(r.data);
    } catch (e) { console.error(e); }
  };

const handleFlightSelect = (flight) => {
    // Validar que sea un vuelo normal (con id) y no un itinerario
    if (!flight || flight.type === 'itinerary') {
        console.log('Itinerario seleccionado, ignorando selección de vuelo:', flight);
        return;
    }
    
    if (!flight.id) {
        console.error('Vuelo inválido seleccionado:', flight);
        alert('Error: El vuelo seleccionado no es válido. Por favor, intenta con otro.');
        return;
    }
    
    setSelectedFlight(flight);
    setSelectedSeat(null);
    setBookingResult(null);
    setActiveTab('seats');
};

  const handleSeatSelect = (seat) => {
    setSelectedSeat(seat);
    setActiveTab('booking');
  };

  const handleBookingComplete = (result) => {
    setBookingResult(result);
    fetchDashboard();
    fetchVectorClock();
    setActiveTab('result');
  };

  // Nav entrance animation on mount
  useEffect(() => {
    if (navRef.current) {
      gsap.fromTo(navRef.current,
        { y: -70, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: 'back.out(1.4)' }
      );
    }
    // Magnetic buttons
    const handleMouse = (e) => {
      document.querySelectorAll('.search-btn,.btn-buy,.btn-pdf,.fc-btn,.nav-tab.active').forEach(btn => {
        const r = btn.getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        const dx = e.clientX - cx, dy = e.clientY - cy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 80) {
          gsap.to(btn, { x: dx * 0.18, y: dy * 0.18, duration: 0.4, ease: 'power2.out' });
        } else {
          gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1,.4)' });
        }
      });
    };
    document.addEventListener('mousemove', handleMouse);
    return () => document.removeEventListener('mousemove', handleMouse);
  }, []);

  /* ── Language-change transition ── */
  useEffect(() => {
    const handle = (e) => {
      const wrap = wrapRef.current;
      if (!wrap) { i18n.changeLanguage(e.detail.code); return; }

      // Phase 1: blur + scale + opacity out
      gsap.to(wrap, {
        opacity: 0,
        scale: 0.97,
        filter: 'blur(7px)',
        duration: 0.22,
        ease: 'power2.in',
        onComplete: () => {
          i18n.changeLanguage(e.detail.code);
          // Phase 2: snap back in after React re-renders
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              gsap.fromTo(wrap,
                { opacity: 0, scale: 0.97, filter: 'blur(7px)' },
                { opacity: 1, scale: 1,    filter: 'blur(0px)', duration: 0.38, ease: 'power3.out' }
              );
            });
          });
        },
      });
    };
    window.addEventListener('lang-will-change', handle);
    return () => window.removeEventListener('lang-will-change', handle);
  }, [i18n]);

  const tabs = [
    { id: 'search',    label: t('flights'),   icon: 'fa-magnifying-glass' },
    { id: 'dashboard', label: t('dashboard'), icon: 'fa-chart-pie' },
    ...(selectedFlight ? [{ id: 'seats', label: t('seats'), icon: 'fa-chair' }] : []),
  ];

  // Determinar el nodo actual a mostrar
  const currentNode = selectedNode ? NODES[selectedNode] : (geo.node || NODES[1]);

  return (
    <>
      <CursorFollower />
      {/* Animated canvas (draws into the #bg-canvas in index.html) */}
      <BgCanvas />

      {/* ── FLOATING NAV ── */}
      <nav className="nav" ref={navRef}>
        {/* Brand */}
        <div className="nav-brand" onClick={() => setActiveTab('search')}>
          <div className="nav-logo">
            <i className="fa-solid fa-plane" />
          </div>
          <span className="nav-name">Aerolíneas Pabón</span>
        </div>

        {/* Tabs */}
        <div className="nav-tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={'nav-tab' + (activeTab === tab.id ? ' active' : '')}
              onClick={() => setActiveTab(tab.id)}
            >
              <i className={`fa-solid ${tab.icon}`} style={{ fontSize: '.7rem' }} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right side */}
        <div className="nav-right">
          {/* Node selector */}
          <div className="nav-node-group">
            {Object.entries(NODES).map(([id, node]) => {
              const isActive = selectedNode ? selectedNode === parseInt(id) : geo.node?.id === parseInt(id);
              return (
                <button
                  key={id}
                  className={'nav-node-btn' + (isActive ? ' active' : '')}
                  onClick={() => handleNodeChange(parseInt(id))}
                >
                  {node.name.substring(0, 3)}
                </button>
              );
            })}
          </div>

          {/* Vector clock */}
          {vectorClock && (
            <div className="nav-vc-badge">
              [{vectorClock.node_1 || 0},{vectorClock.node_2 || 0},{vectorClock.node_3 || 0}]
            </div>
          )}

          {/* Node status */}
          <div className="node-pill">
            <div className="node-dot" />
            <span className="node-txt">{currentNode.name.substring(0, 6)}</span>
          </div>

          {/* Theme toggle */}
          <button className="theme-btn" onClick={toggleTheme} title="Cambiar tema">
            <i className={`fa-solid ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`} />
          </button>

          <LanguageSwitcher />
        </div>
      </nav>

      {/* ── MAIN CONTENT ── */}
      <div className="app-wrapper">
        <div className="wrap" ref={wrapRef}>

          {/* Search / Hero screen */}
          {activeTab === 'search' && (
            <div className="fade-up">
              <FlightSearch apiUrl={apiUrl} onFlightSelect={handleFlightSelect} />
            </div>
          )}

          {/* Seats screen */}
          {activeTab === 'seats' && selectedFlight && (
            <div className="fade-up" style={{ paddingTop: '24px', paddingBottom: '60px' }}>
              {/* Flight strip */}
              <div className="flight-strip">
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <button className="btn-back2" onClick={() => setActiveTab('search')}>
                    <i className="fa-solid fa-arrow-left" />
                    {t('back')}
                  </button>
                  <div className="fs-route">
                    <span className="fs-code">{selectedFlight.origin_code}</span>
                    <div className="fs-line">
                      <div className="fs-line-dash" />
                      <i className="fa-solid fa-plane" />
                      <div className="fs-line-dash" />
                    </div>
                    <span className="fs-code">{selectedFlight.destination_code}</span>
                  </div>
                  <span className="fs-info">
                    {selectedFlight.flight_number} &middot; {selectedFlight.departure_date?.substring(0, 10)} &middot; {t('gate')} {selectedFlight.gate}
                  </span>
                </div>
                <div className="fs-badge">
                  <i className="fa-solid fa-circle-check" style={{ fontSize: '.65rem' }} />
                  {t('scheduled')}
                </div>
              </div>

              <SeatMap
                apiUrl={apiUrl}
                flightId={selectedFlight.id}
                onSeatSelect={handleSeatSelect}
                flight={selectedFlight}
              />
            </div>
          )}

          {/* Booking form */}
          {activeTab === 'booking' && selectedFlight && selectedSeat && (
            <div className="fade-up" style={{ paddingTop: '24px', paddingBottom: '60px' }}>
              <BookingForm
                apiUrl={apiUrl}
                flight={selectedFlight}
                seat={selectedSeat}
                onComplete={handleBookingComplete}
                onCancel={() => setActiveTab('seats')}
              />
            </div>
          )}

          {/* Result / Boarding pass */}
          {activeTab === 'result' && bookingResult && (
            <div className="fade-up" style={{ maxWidth: '480px', margin: '24px auto 60px' }}>
              <BoardingPassResult
                result={bookingResult}
                flight={selectedFlight}
                apiUrl={apiUrl}
                onNew={() => {
                  setActiveTab('search');
                  setSelectedFlight(null);
                  setSelectedSeat(null);
                  setBookingResult(null);
                }}
                t={t}
              />
            </div>
          )}

          {/* Dashboard */}
          {activeTab === 'dashboard' && (
            <div className="fade-up" style={{ paddingTop: '24px', paddingBottom: '60px' }}>
              {dashboardData
                ? <Dashboard data={dashboardData} />
                : (
                  <div className="state-box">
                    <i className="fa-solid fa-circle-notch fa-spin" />
                    <p>{t('loadingDashboard')}</p>
                  </div>
                )
              }
            </div>
          )}

        </div>
      </div>
    </>
  );
}

/* ── Boarding Pass Result Card ── */
function BoardingPassResult({ result, flight, apiUrl, onNew, t }) {
  const [walletQr, setWalletQr] = React.useState(null);
  const [walletViewUrl, setWalletViewUrl] = React.useState(null);
  const [googleWalletUrl, setGoogleWalletUrl] = React.useState(null);
  const [loadingWallet, setLoadingWallet] = React.useState(false);
  const [pdfFlash, setPdfFlash] = React.useState(false);

  const passRef       = useRef(null);
  const passTopRef    = useRef(null);
  const passPerfRef   = useRef(null);
  const passBodyRef   = useRef(null);
  const passGridRef   = useRef(null);
  const actionsRef    = useRef(null);
  const qrPanelRef    = useRef(null);
  const walletBtnRef  = useRef(null);
  const pdfBtnRef     = useRef(null);
  const barcodeRef    = useRef(null);

  /* ── 1. Reveal animation when boarding pass mounts ── */
  useEffect(() => {
    if (!passRef.current) return;
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    // Card slides up from below
    tl.fromTo(passRef.current,
      { opacity: 0, y: 60, scale: 0.94 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6 }
    )
    // Top header fades in
    .fromTo(passTopRef.current,
      { opacity: 0, y: -20 },
      { opacity: 1, y: 0, duration: 0.4 }, '-=0.3'
    )
    // Perforation draws in from left
    .fromTo(passPerfRef.current,
      { scaleX: 0, transformOrigin: 'left center' },
      { scaleX: 1, duration: 0.4, ease: 'power2.out' }, '-=0.2'
    )
    // Body fades up
    .fromTo(passBodyRef.current,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.35 }, '-=0.15'
    )
    // Grid items stagger in
    .fromTo(passGridRef.current?.children || [],
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.3, stagger: 0.06 }, '-=0.2'
    )
    // Barcode scans in
    .fromTo(barcodeRef.current,
      { scaleX: 0, transformOrigin: 'left center' },
      { scaleX: 1, duration: 0.45, ease: 'power2.inOut' }, '-=0.1'
    )
    // Action buttons stagger up
    .fromTo(actionsRef.current?.children || [],
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.3, stagger: 0.08 }, '-=0.2'
    );
  }, []);

  /* ── 2. QR panel reveal when walletQr changes ── */
  useEffect(() => {
    if (!walletQr || !qrPanelRef.current) return;
    const panel = qrPanelRef.current;
    const img   = panel.querySelector('img');

    // Scroll arranca inmediatamente junto con la animación
    const target = panel.getBoundingClientRect().top + window.scrollY - 40;
    gsap.to(window, { scrollTo: target, duration: 0.75, ease: 'power2.inOut' });

    // Animación del panel empieza con leve delay para que el scroll ya esté en camino
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' }, delay: 0.25 });

    // Panel despliega desde arriba
    tl.fromTo(panel,
      { opacity: 0, scaleY: 0, transformOrigin: 'top center' },
      { opacity: 1, scaleY: 1, duration: 0.35, ease: 'back.out(1.4)' }
    )
    // QR se revela en círculo desde el centro hacia afuera
    .fromTo(img,
      { opacity: 1, clipPath: 'circle(0% at 50% 50%)' },
      { clipPath: 'circle(75% at 50% 50%)', duration: 1.1, ease: 'power2.inOut' }, '-=0.1'
    )
    // Glow suave en la imagen
    .fromTo(img.parentElement,
      { boxShadow: '0 0 0px rgba(75,130,255,0)' },
      { boxShadow: '0 8px 40px rgba(75,130,255,.55)', duration: 0.6 }, '-=0.8'
    )
    // Textos y botones suben en stagger
    .fromTo(panel.querySelectorAll('p, a, button'),
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.35, stagger: 0.09 }, '-=0.3'
    );
  }, [walletQr]);

  if (!result.success) {
    return (
      <div className="form-card" style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255,80,80,.1)', border: '1px solid rgba(255,80,80,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <i className="fa-solid fa-xmark" style={{ color: 'var(--red)', fontSize: '1.5rem' }} />
        </div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--red)', marginBottom: '8px' }}>{t('bookingError')}</h2>
        <p style={{ color: 'var(--t2)', marginBottom: '24px' }}>{result.message}</p>
        <button className="btn-pdf" onClick={onNew}>{t('newBooking')}</button>
      </div>
    );
  }

  const sale    = result.sale;
  const isFirst = sale?.class_type === 'FIRST';

  /* ── 3. Wallet button animation on click ── */
  const handleWallet = async () => {
    if (walletBtnRef.current) {
      gsap.fromTo(walletBtnRef.current,
        { scale: 1 },
        { scale: 0.93, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.inOut' }
      );
    }
    if (walletQr) { setWalletQr(null); setWalletViewUrl(null); setGoogleWalletUrl(null); return; }
    setLoadingWallet(true);
    try {
      const r = await axios.get(apiUrl + '/boarding-pass/wallet?ticket=' + sale?.ticket_number);
      setWalletQr(r.data.qrCode);
      setWalletViewUrl(r.data.viewUrl || null);
      setGoogleWalletUrl(r.data.googleWalletUrl || null);
    } catch (error) {
      console.error('Error fetching wallet:', error);
    } finally {
      setLoadingWallet(false);
    }
  };

  /* ── 4. PDF button animation on click ── */
  const handlePdf = () => {
    if (pdfBtnRef.current) {
      const tl = gsap.timeline();
      tl.to(pdfBtnRef.current, { scale: 0.93, duration: 0.08, ease: 'power2.in' })
        .to(pdfBtnRef.current, { scale: 1.04, duration: 0.12, ease: 'back.out(2)' })
        .to(pdfBtnRef.current, { scale: 1, duration: 0.2, ease: 'power2.out' });
      // Flash white overlay
      setPdfFlash(true);
      setTimeout(() => setPdfFlash(false), 400);
    }
    window.open(apiUrl + '/boarding-pass/pdf?ticket=' + sale?.ticket_number, '_blank');
  };

  return (
    <div className="pass-outer" ref={passRef} style={{ opacity: 0 }}>
      <div className="pass-inner">

        {/* Top gradient header */}
        <div className="pass-top" ref={passTopRef}>
          <div className="pass-meta">
            <div className="pass-label">
              <i className="fa-solid fa-ticket" />
              {t('eBoardingPass')}
            </div>
            <span className="pass-fnum">{flight?.flight_number}</span>
          </div>
          <div className="pass-route">
            <div>
              <div className="pass-city">{flight?.origin_code || '—'}</div>
              <div className="pass-city-lbl">{t('origin2')}</div>
            </div>
            <div className="pass-line">
              <div className="pass-line-bar">
                <div className="pass-dot" />
                <div className="pass-dash" />
                <i className="fa-solid fa-plane" style={{ fontSize: '.88rem', color: '#fff', opacity: .8 }} />
                <div className="pass-dash" />
                <div className="pass-dot" />
              </div>
              <div className="pass-fn">{flight?.flight_number}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="pass-city">{flight?.destination_code || '—'}</div>
              <div className="pass-city-lbl">{t('dest2')}</div>
            </div>
          </div>
        </div>

        {/* Perforated divider */}
        <div className="pass-perf" ref={passPerfRef}>
          <div className="pass-perf-line" />
        </div>

        {/* Details body */}
        <div className="pass-body" ref={passBodyRef}>
          <div className="pass-grid" ref={passGridRef}>
            {[
              { label: t('class'), value: isFirst ? t('firstClass') : t('economy') },
              { label: t('seat'),  value: sale?.seat_number },
              { label: t('gate'),  value: flight?.gate || '—' },
              { label: t('total'), value: '$' + parseFloat(sale?.price_paid || 0).toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="pg-lbl">{label}</div>
                <div className="pg-val">{value}</div>
              </div>
            ))}
          </div>

          {/* Ticket number */}
          <div className="pass-ticket">
            <div>
              <div className="pt-lbl">{t('ticket')}</div>
              <div className="pt-val">{sale?.ticket_number}</div>
            </div>
            <i className="fa-solid fa-barcode" style={{ color: 'var(--t3)', fontSize: '1.3rem' }} />
          </div>

          {/* Barcode */}
          <div className="barcode" ref={barcodeRef} />
          <div className="barcode-num">{sale?.ticket_number}</div>

          {/* Action buttons */}
          <div className="pass-actions" ref={actionsRef}>
            <button
              ref={pdfBtnRef}
              className="btn-pdf"
              onClick={handlePdf}
              style={{ position: 'relative', overflow: 'hidden' }}
            >
              {pdfFlash && (
                <span style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.35)', borderRadius: 'inherit', pointerEvents: 'none', animation: 'pdf-flash .4s ease-out forwards' }} />
              )}
              <i className="fa-solid fa-file-pdf" />
              {t('download')}
            </button>

            <button ref={walletBtnRef} className="btn-wallet" onClick={handleWallet} disabled={loadingWallet}>
              {loadingWallet
                ? <><i className="fa-solid fa-circle-notch fa-spin" />{t('processing')}</>
                : <><i className="fa-solid fa-qrcode" />{walletQr ? t('hideQr') : t('wallet')}</>
              }
            </button>

            {/* Wallet QR panel */}
            {walletQr && (
              <div ref={qrPanelRef} style={{ background: 'linear-gradient(160deg,#060818 0%,#0D1B4B 100%)', borderRadius: '18px', padding: '20px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(75,130,255,.35) 0%,transparent 70%)', pointerEvents: 'none' }} />
                <p style={{ fontSize: '.62rem', fontWeight: 700, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.15em', marginBottom: '14px', position: 'relative' }}>
                  <i className="fa-solid fa-mobile-screen" style={{ marginRight: '6px', color: 'rgba(255,255,255,.6)' }} />
                  {t('scanPhone')}
                </p>
                <div style={{ display: 'inline-block', background: '#fff', borderRadius: '14px', padding: '10px', boxShadow: '0 8px 32px rgba(75,130,255,.4)', position: 'relative', marginBottom: '14px' }}>
                  <img src={walletQr} alt="Wallet QR" style={{ width: '220px', height: '220px', display: 'block', borderRadius: '6px' }} />
                </div>
                <p style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.55)', position: 'relative', lineHeight: 1.5, marginBottom: '14px' }}>
                  {t('scanDesc')}
                </p>
                {googleWalletUrl && (
                  <a href={googleWalletUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', background: '#000', color: '#fff', borderRadius: '12px', padding: '13px 20px', fontSize: '.88rem', fontWeight: 700, textDecoration: 'none', marginBottom: '10px', position: 'relative', boxShadow: '0 4px 18px rgba(0,0,0,.5)' }}>
                    <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11 0C4.925 0 0 4.925 0 11s4.925 11 11 11 11-4.925 11-11S17.075 0 11 0z" fill="#4285F4"/>
                      <path d="M11 0C4.925 0 0 4.925 0 11h11V0z" fill="#EA4335"/>
                      <path d="M0 11c0 6.075 4.925 11 11 11V11H0z" fill="#34A853"/>
                      <path d="M22 11c0-6.075-4.925-11-11-11v11h11z" fill="#FBBC05"/>
                    </svg>
                    {t('saveGoogleWallet')}
                  </a>
                )}
                {walletViewUrl && (
                  <button className="btn-wallet" style={{ fontSize: '.72rem', padding: '8px 18px', borderColor: 'rgba(255,255,255,.3)', color: 'rgba(255,255,255,.8)', background: 'rgba(255,255,255,.08)', position: 'relative', width: '100%' }} onClick={() => window.open(walletViewUrl, '_blank')}>
                    <i className="fa-solid fa-arrow-up-right-from-square" />
                    {t('openDigitalPass')}
                  </button>
                )}
              </div>
            )}

            <button className="btn-new" onClick={onNew}>
              <i className="fa-solid fa-rotate-right" />
              {t('newBooking')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
