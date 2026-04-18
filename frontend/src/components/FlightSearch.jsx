import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { gsap } from 'gsap';

/* ─── country flags ─────────────────────────────── */
const COUNTRY_FLAGS = {
  USA: '🇺🇸', CHINA: '🇨🇳', UAE: '🇦🇪', JAPAN: '🇯🇵',
  UK: '🇬🇧', FRANCE: '🇫🇷', GERMANY: '🇩🇪', TURKEY: '🇹🇷',
  SINGAPORE: '🇸🇬', SPAIN: '🇪🇸', NETHERLANDS: '🇳🇱', BRAZIL: '🇧🇷',
};

/* ═══════════════════════════════════════════════════
   SPACE BACKGROUND — canvas with stars + 3-D planet
═══════════════════════════════════════════════════ */
function SpaceBackground({ planetDataRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let raf;
    let rotation = 0;
    let logW = 0, logH = 0;
    let stars = [];

    const mkStars = (W, H) => {
      stars = Array.from({ length: 170 }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.25 + 0.18,
        base: Math.random() * 0.55 + 0.12,
        ph: Math.random() * Math.PI * 2,
        sp: Math.random() * 0.022 + 0.004,
      }));
    };

    const resize = () => {
      logW = canvas.offsetWidth  || 800;
      logH = canvas.offsetHeight || 600;
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = logW * dpr;
      canvas.height = logH * dpr;
      ctx.scale(dpr, dpr);
      mkStars(logW, logH);
    };

    resize();

    const draw = () => {
      if (!logW || !logH) { raf = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, logW, logH);

      /* Planet position — slightly right of center */
      const px = logW * 0.64;
      const py = logH * 0.42;
      const pr = Math.min(logW, logH) * 0.30;

      /* Expose to orbiting planes */
      if (planetDataRef) planetDataRef.current = { x: px, y: py, r: pr };

      /* ── twinkling stars ── */
      stars.forEach(s => {
        s.ph += s.sp;
        const a = s.base * (0.62 + 0.38 * Math.sin(s.ph));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
        ctx.fill();
      });

      /* ── outer atmosphere glow ── */
      const glow = ctx.createRadialGradient(px, py, pr * 0.72, px, py, pr * 1.6);
      glow.addColorStop(0,   'rgba(55,105,255,0.24)');
      glow.addColorStop(0.4, 'rgba(55,105,255,0.08)');
      glow.addColorStop(1,   'rgba(55,105,255,0)');
      ctx.beginPath();
      ctx.arc(px, py, pr * 1.6, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      /* ── planet base ── */
      const base = ctx.createRadialGradient(
        px - pr * 0.38, py - pr * 0.34, pr * 0.02,
        px + pr * 0.14, py + pr * 0.20, pr * 1.06
      );
      base.addColorStop(0,    '#5092ff');
      base.addColorStop(0.20, '#2357c6');
      base.addColorStop(0.48, '#102c70');
      base.addColorStop(0.76, '#07183c');
      base.addColorStop(1,    '#020c1e');
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = base;
      ctx.fill();

      /* ── grid lines clipped to planet ── */
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, pr - 0.5, 0, Math.PI * 2);
      ctx.clip();

      /* latitude rings */
      for (let lat = -72; lat <= 72; lat += 18) {
        const lr = (lat * Math.PI) / 180;
        const yp = py + pr * Math.sin(lr);
        const rx = pr * Math.cos(lr);
        const depth = (1 + Math.sin(lr)) / 2;
        ctx.beginPath();
        ctx.ellipse(px, yp, rx, rx * 0.27, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(130,185,255,${(0.06 + depth * 0.05).toFixed(2)})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }

      /* longitude lines (rotating) */
      for (let lon = 0; lon < 180; lon += 22) {
        const ang = ((lon + rotation) % 360) * Math.PI / 180;
        const cA = Math.cos(ang);
        const sA = Math.sin(ang);
        const front = (cA + 1) / 2;
        if (front < 0.02) continue;
        ctx.beginPath();
        ctx.ellipse(px + sA * pr * 0.04, py, Math.abs(cA) * pr, pr, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(130,185,255,${(0.03 + front * 0.10).toFixed(2)})`;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }

      /* stylised land-mass blobs */
      const lr = (rotation % 360) * Math.PI / 180;
      const blobs = [
        { ox:  0.26, oy: -0.22, rx: 0.20, ry: 0.13, r: lr + 0.4 },
        { ox: -0.30, oy:  0.14, rx: 0.22, ry: 0.12, r: lr + 1.3 },
        { ox:  0.06, oy:  0.30, rx: 0.17, ry: 0.10, r: lr + 2.6 },
        { ox: -0.14, oy: -0.30, rx: 0.13, ry: 0.08, r: lr + 3.9 },
      ];
      ctx.globalAlpha = 0.052;
      ctx.fillStyle = '#a8ceff';
      blobs.forEach(b => {
        const bx = px + pr * (b.ox * Math.cos(lr) - b.oy * Math.sin(lr));
        const by = py + pr * (b.ox * Math.sin(lr) + b.oy * Math.cos(lr));
        ctx.beginPath();
        ctx.ellipse(bx, by, pr * b.rx, pr * b.ry, b.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      ctx.restore();

      /* ── atmosphere rim ── */
      const rim = ctx.createRadialGradient(px, py, pr * 0.80, px, py, pr);
      rim.addColorStop(0,    'rgba(75,130,255,0)');
      rim.addColorStop(0.68, 'rgba(75,130,255,0.05)');
      rim.addColorStop(0.88, 'rgba(110,165,255,0.18)');
      rim.addColorStop(1,    'rgba(150,200,255,0.33)');
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = rim;
      ctx.fill();

      /* ── specular highlight ── */
      const spec = ctx.createRadialGradient(
        px - pr * 0.40, py - pr * 0.36, 0,
        px - pr * 0.20, py - pr * 0.15, pr * 0.60
      );
      spec.addColorStop(0,    'rgba(255,255,255,0.19)');
      spec.addColorStop(0.45, 'rgba(255,255,255,0.05)');
      spec.addColorStop(1,    'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = spec;
      ctx.fill();

      /* ── dark terminator shadow ── */
      const term = ctx.createRadialGradient(
        px + pr * 0.54, py + pr * 0.16, 0,
        px + pr * 0.18, py + pr * 0.06, pr * 0.95
      );
      term.addColorStop(0,    'rgba(2,6,18,0.80)');
      term.addColorStop(0.45, 'rgba(2,6,18,0.40)');
      term.addColorStop(1,    'rgba(2,6,18,0)');
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = term;
      ctx.fill();

      rotation += 0.055;
      raf = requestAnimationFrame(draw);
    };

    draw();
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} className="planet-canvas" />;
}

/* ═══════════════════════════════════════════════════
   ORBITING PLANES — 3 planes on elliptical orbits
═══════════════════════════════════════════════════ */
function OrbitingPlanes({ planetDataRef }) {
  const elRefs = useRef([]);

  useEffect(() => {
    /* ra, rb = multiples of planet radius; tilt in radians */
    const orbits = [
      { ra: 1.50, rb: 0.36, tilt: -0.28, speed:  0.0075, phase: 0.0  },
      { ra: 1.24, rb: 0.45, tilt:  0.58, speed: -0.0058, phase: 2.1  },
      { ra: 1.68, rb: 0.21, tilt:  1.22, speed:  0.0048, phase: 4.3  },
    ];
    const SIZES = [18, 14, 11];

    let t = 0;

    const tick = () => {
      const pd = planetDataRef.current;
      if (!pd) return;
      const { x: cx, y: cy, r: pr } = pd;

      orbits.forEach((orb, i) => {
        const el = elRefs.current[i];
        if (!el) return;

        const a = orb.phase + t * orb.speed;
        const cosA = Math.cos(a);
        const sinA = Math.sin(a);
        const cosT = Math.cos(orb.tilt);
        const sinT = Math.sin(orb.tilt);

        const lx = orb.ra * pr * cosA;
        const ly = orb.rb * pr * sinA;

        const x = cx + lx * cosT - ly * sinT;
        const y = cy + lx * sinT + ly * cosT;

        /* tangent direction → plane rotation */
        const dvx = -(orb.ra * pr * sinA * cosT) - (orb.rb * pr * cosA * sinT);
        const dvy = -(orb.ra * pr * sinA * sinT) + (orb.rb * pr * cosA * cosT);
        const rot = Math.atan2(dvy, dvx) * 180 / Math.PI;

        /* depth: sinA > 0 → in front of planet */
        const inFront = sinA > 0;
        const half = SIZES[i] / 2;

        el.style.transform = `translate(${(x - half).toFixed(1)}px,${(y - half).toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`;
        el.style.opacity   = inFront ? '1' : '0.18';
        el.style.zIndex    = inFront ? '12' : '2';
      });

      t++;
    };

    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  return (
    <>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          ref={el => elRefs.current[i] = el}
          className="orbit-plane"
          style={{ fontSize: [18, 14, 11][i] + 'px' }}
        >
          ✈
        </div>
      ))}
    </>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════ */
export default function FlightSearch({ apiUrl, onFlightSelect }) {
  const API_URL = apiUrl || 'http://localhost:3001/api/v1';
  const { t, i18n } = useTranslation();

  const [originAirports, setOriginAirports]         = useState([]);
  const [destinationAirports, setDestinationAirports] = useState([]);
  const [origin, setOrigin]           = useState(null);
  const [destination, setDestination] = useState(null);
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [flights, setFlights]         = useState([]);
  const [loading, setLoading]         = useState(false);
  const [searched, setSearched]       = useState(false);
  const [dateRange, setDateRange]     = useState({ min: '', max: '' });

  const [originDropdownOpen, setOriginDropdownOpen] = useState(false);
  const [destDropdownOpen, setDestDropdownOpen]     = useState(false);
  const [originSearchTerm, setOriginSearchTerm]     = useState('');
  const [destSearchTerm, setDestSearchTerm]         = useState('');
  const [originFiltered, setOriginFiltered]         = useState([]);
  const [destFiltered, setDestFiltered]             = useState([]);

  const [currentPage, setCurrentPage]   = useState(1);
  const [totalPages, setTotalPages]     = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [hasNext, setHasNext]           = useState(false);
  const [hasPrev, setHasPrev]           = useState(false);

  /* ── refs ── */
  const heroRef        = useRef(null);
  const eyebrowRef     = useRef(null);
  const titleRef       = useRef(null);
  const subRef         = useRef(null);
  const panelRef       = useRef(null);
  const statsRef       = useRef(null);
  const flightListRef  = useRef(null);
  const resultsRef     = useRef(null);
  const originFieldRef = useRef(null);
  const destFieldRef   = useRef(null);
  const origDropRef    = useRef(null);
  const destDropRef    = useRef(null);
  const startFieldRef  = useRef(null);
  const endFieldRef    = useRef(null);
  const startDateRef   = useRef(null);
  const endDateRef     = useRef(null);
  const searchBtnRef   = useRef(null);
  const planetDataRef  = useRef(null);

  /* ── hero entrance ── */
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    if (eyebrowRef.current)
      tl.fromTo(eyebrowRef.current, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5 });
    if (titleRef.current)
      tl.fromTo(titleRef.current.children,
        { opacity: 0, y: 28 },
        { opacity: 1, y: 0, duration: 0.55, stagger: 0.1 }, '-=0.25');
    if (subRef.current)
      tl.fromTo(subRef.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45 }, '-=0.3');
    if (panelRef.current)
      tl.fromTo(panelRef.current,
        { opacity: 0, y: 32, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.55, ease: 'back.out(1.2)' }, '-=0.3');
    if (statsRef.current)
      tl.fromTo(statsRef.current.children,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.08 }, '-=0.3');
  }, []);

  /* ── flight list animation ── */
  useEffect(() => {
    if (flightListRef.current && flights.length > 0) {
      gsap.fromTo(
        flightListRef.current.querySelectorAll('.flight-card'),
        { opacity: 0, y: 22, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.06, ease: 'back.out(1.2)', delay: 0.1 }
      );
    }
  }, [flights]);

  /* ── dropdown open animation ── */
  const animDropOpen = (ref) => {
    if (!ref.current) return;
    gsap.fromTo(ref.current,
      { opacity: 0, y: -8, scaleY: 0.88, transformOrigin: 'top center' },
      { opacity: 1, y: 0,  scaleY: 1,    duration: 0.22, ease: 'back.out(1.4)' }
    );
    gsap.fromTo(ref.current.querySelectorAll('.sp-drop-item'),
      { opacity: 0, x: -8 },
      { opacity: 1, x: 0, duration: 0.18, stagger: 0.03, ease: 'power3.out', delay: 0.06 }
    );
  };

  useEffect(() => { if (originDropdownOpen) setTimeout(() => animDropOpen(origDropRef), 0); }, [originDropdownOpen]);
  useEffect(() => { if (destDropdownOpen)   setTimeout(() => animDropOpen(destDropRef),  0); }, [destDropdownOpen]);

  /* ── press animations ── */
  const animFieldPress = (ref) => {
    if (!ref.current) return;
    gsap.timeline()
      .to(ref.current, { scale: 0.96, duration: 0.08, ease: 'power2.in' })
      .to(ref.current, { scale: 1,    duration: 0.28, ease: 'back.out(2.5)' });
  };

  const animBtnPress = (ref) => {
    if (!ref.current) return;
    gsap.timeline()
      .to(ref.current, { scale: 0.93, y: 2, duration: 0.09, ease: 'power2.in' })
      .to(ref.current, { scale: 1,    y: 0, duration: 0.35, ease: 'back.out(2)' });
  };

  /* ── airport helpers ── */
  const getAirportName = (code) => ({
    ATL: 'Hartsfield-Jackson Atlanta Intl', PEK: 'Beijing Capital Intl',
    DXB: 'Dubai International',            TYO: 'Tokyo Haneda Intl',
    LON: 'London Heathrow',                LAX: 'Los Angeles Intl',
    PAR: 'Charles de Gaulle',              FRA: 'Frankfurt Airport',
    IST: 'Istanbul Airport',               SIN: 'Singapore Changi',
    MAD: 'Madrid-Barajas',                 AMS: 'Amsterdam Schiphol',
    DFW: 'Dallas/Fort Worth',              CAN: 'Guangzhou Baiyun',
    SAO: 'São Paulo Guarulhos',
  })[code] || `${code} Airport`;

  const getCityName = (code) => ({
    ATL: 'Atlanta',  PEK: 'Beijing',  DXB: 'Dubai',   TYO: 'Tokyo',
    LON: 'London',   LAX: 'Los Angeles', PAR: 'Paris', FRA: 'Frankfurt',
    IST: 'Istanbul', SIN: 'Singapore', MAD: 'Madrid',  AMS: 'Amsterdam',
    DFW: 'Dallas',   CAN: 'Guangzhou', SAO: 'São Paulo',
  })[code] || code;

  const getCountry = (code) => ({
    ATL: 'USA',  PEK: 'CHINA', DXB: 'UAE',   TYO: 'JAPAN',
    LON: 'UK',   LAX: 'USA',   PAR: 'FRANCE', FRA: 'GERMANY',
    IST: 'TURKEY', SIN: 'SINGAPORE', MAD: 'SPAIN', AMS: 'NETHERLANDS',
    DFW: 'USA',  CAN: 'CHINA', SAO: 'BRAZIL',
  })[code] || '';

  const mapAirportCodes = (codes = []) => codes.map(code => ({
    code, name: getAirportName(code), city: getCityName(code),
    country: getCountry(code), flag: COUNTRY_FLAGS[getCountry(code)] || '🌍',
  }));

  /* ── data fetching ── */
  useEffect(() => {
    axios.get(`${API_URL}/flights/valid-origins`)
      .then(r => r.data.success && setOriginAirports(mapAirportCodes(r.data.origins || [])))
      .catch(console.error);
  }, [API_URL]);

  useEffect(() => {
    if (!origin) { setDestinationAirports([]); setDestination(null); setDestSearchTerm(''); return; }
    axios.get(`${API_URL}/flights/destinations`, { params: { origin: origin.code } })
      .then(r => {
        if (r.data.success) {
          const list = mapAirportCodes(r.data.destinations || []);
          setDestinationAirports(list);
          if (destination && !list.some(a => a.code === destination.code)) {
            setDestination(null); setDestSearchTerm(''); setStartDate(''); setEndDate('');
            setDateRange({ min: '', max: '' });
          }
        }
      }).catch(() => setDestinationAirports([]));
  }, [API_URL, origin]);

  useEffect(() => {
    if (origin && destination) fetchAvailableDates();
    else { setDateRange({ min: '', max: '' }); setStartDate(''); setEndDate(''); }
  }, [origin, destination]);

  useEffect(() => {
    setOriginFiltered(
      originAirports
        .filter(a => (!destination || a.code !== destination.code) &&
          (a.code.toLowerCase().includes(originSearchTerm.toLowerCase()) ||
           a.city.toLowerCase().includes(originSearchTerm.toLowerCase())))
        .slice(0, 8)
    );
  }, [originSearchTerm, originAirports, destination]);

  useEffect(() => {
    setDestFiltered(
      destinationAirports
        .filter(a => (!origin || a.code !== origin.code) &&
          (a.code.toLowerCase().includes(destSearchTerm.toLowerCase()) ||
           a.city.toLowerCase().includes(destSearchTerm.toLowerCase())))
        .slice(0, 8)
    );
  }, [destSearchTerm, destinationAirports, origin]);

  /* ── click outside ── */
  useEffect(() => {
    const h = (e) => {
      if (originFieldRef.current && !originFieldRef.current.contains(e.target)) setOriginDropdownOpen(false);
      if (destFieldRef.current   && !destFieldRef.current.contains(e.target))   setDestDropdownOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const fetchAvailableDates = async () => {
    try {
      const r = await axios.get(`${API_URL}/flights/available-dates`,
        { params: { origin: origin.code, destination: destination.code } });
      if (r.data.success && r.data.dates?.length > 0) {
        setDateRange({ min: r.data.minDate, max: r.data.maxDate });
        if (!startDate) setStartDate((r.data.minDate || '').substring(0, 10));
        if (!endDate)   setEndDate((r.data.maxDate || '').substring(0, 10));
      }
    } catch (e) { console.error(e); }
  };

  const scrollToResults = () => {
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  };

  const searchFlights = async (page = 1) => {
    if (!origin && !destination && !startDate && !endDate) {
      setFlights([]); setSearched(true); setTotalResults(0);
      scrollToResults(); return;
    }
    setLoading(true);
    try {
      const params = {};
      if (origin)      params.origin      = origin.code;
      if (destination) params.destination = destination.code;
      if (startDate)   params.startDate   = startDate;
      if (endDate)     params.endDate     = endDate;
      params.page = page; params.limit = 20;
      const r = await axios.get(`${API_URL}/flights`, { params });
      if (r.data.success) {
        setFlights(r.data.data);
        setCurrentPage(r.data.pagination.page);
        setTotalPages(r.data.pagination.pages);
        setTotalResults(r.data.pagination.total);
        setHasNext(r.data.pagination.hasNext);
        setHasPrev(r.data.pagination.hasPrev);
      } else { setFlights([]); setTotalResults(0); }
      setSearched(true);
      scrollToResults();
    } catch (e) {
      console.error(e); setFlights([]); setTotalResults(0); setSearched(true);
      scrollToResults();
    } finally { setLoading(false); }
  };

  const handleSearch = () => { animBtnPress(searchBtnRef); setCurrentPage(1); searchFlights(1); };
  const goToPage = (n) => { if (n >= 1 && n <= totalPages) searchFlights(n); };

  const swapLocations = (e) => {
    e.stopPropagation();
    if (!origin && !destination) return;
    setOrigin(destination); setDestination(origin);
    setOriginSearchTerm(destination ? destination.city : '');
    setDestSearchTerm(origin ? origin.city : '');
    setStartDate(''); setEndDate(''); setDateRange({ min: '', max: '' });
  };

  const selectOrigin = (airport) => {
    setOrigin(airport); setOriginSearchTerm(airport.city); setOriginDropdownOpen(false);
    if (!destination || destination.code === airport.code) { setDestination(null); setDestSearchTerm(''); }
    setStartDate(''); setEndDate(''); setDateRange({ min: '', max: '' });
  };

  const selectDestination = (airport) => {
    setDestination(airport); setDestSearchTerm(airport.city); setDestDropdownOpen(false);
    setStartDate(''); setEndDate('');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const clean = String(dateStr).substring(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return '';
    const d = new Date(clean + 'T12:00:00');
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(i18n.language?.split('-')[0] || 'es',
      { day: '2-digit', month: 'short', year: 'numeric' });
  };
  const formatTime = (v) => (v || '').substring(0, 5);

  /* ────────────────────── JSX ────────────────────── */
  return (
    <div>

      {/* ══════════════════ HERO ══════════════════ */}
      <div className="hero2" ref={heroRef}>

        {/* 3-D space background */}
        <SpaceBackground planetDataRef={planetDataRef} />
        <OrbitingPlanes  planetDataRef={planetDataRef} />

        {/* Decorative dot grid */}
        <div className="h2-grid" />

        {/* ── Title area ── */}
        <div className="h2-top">
          <div className="h2-eyebrow" ref={eyebrowRef}>
            <i className="fa-solid fa-globe" style={{ fontSize: '.65rem' }} />
            {t('heroEyebrow')}
          </div>

          <div ref={titleRef} className="h2-title-wrap">
            <h1 className="h2-h1">{t('heroTitleMain')}</h1>
            <h1 className="h2-h1 h2-accent">{t('heroTitleAccent')}</h1>
          </div>

          <p className="h2-sub" ref={subRef}>{t('heroSub')}</p>
        </div>

        {/* ══ SEARCH PANEL — 2-row layout ══ */}
        <div className="sp-panel" ref={panelRef}>

          {/* ── Row 1: airports ── */}
          <div className="sp-row">
            <div className="sp-field sp-airport-field" ref={originFieldRef}
              onClick={() => { animFieldPress(originFieldRef); setOriginDropdownOpen(v => !v); }}>
              <div className="sp-lbl">
                <i className="fa-solid fa-plane-departure" />{t('origin')}
              </div>
              {origin ? (
                <div className="sp-val">
                  <span className="sp-flag">{origin.flag}</span>
                  <div>
                    <div className="sp-code">{origin.code}</div>
                    <div className="sp-city">{origin.city}</div>
                  </div>
                </div>
              ) : (
                <div className="sp-placeholder">{t('originPlaceholder')}</div>
              )}

              {originDropdownOpen && (
                <div className="sp-drop" ref={origDropRef}>
                  <div className="sp-drop-search">
                    <i className="fa-solid fa-magnifying-glass" />
                    <input
                      type="text"
                      placeholder={t('searchAirport')}
                      value={originSearchTerm}
                      autoFocus
                      onChange={(e) => {
                        const v = e.target.value;
                        setOriginSearchTerm(v);
                        if (!v.trim()) {
                          setOrigin(null); setDestination(null); setDestinationAirports([]);
                          setDestSearchTerm(''); setStartDate(''); setEndDate('');
                          setDateRange({ min: '', max: '' });
                        }
                      }}
                    />
                  </div>
                  <div className="sp-drop-list">
                    {originFiltered.map(ap => (
                      <div key={ap.code} className="sp-drop-item"
                        onClick={(e) => { e.stopPropagation(); selectOrigin(ap); }}>
                        <span className="sp-di-flag">{ap.flag}</span>
                        <div className="sp-di-info">
                          <div className="sp-di-city">{ap.city}</div>
                          <div className="sp-di-name">{ap.name.substring(0, 26)}</div>
                        </div>
                        <span className="sp-di-code">{ap.code}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Swap */}
            <div className="sp-sep">
              <button className="sp-swap" onClick={swapLocations} title="Swap">
                <i className="fa-solid fa-arrow-right-arrow-left" />
              </button>
            </div>

            {/* Destination */}
            <div className={`sp-field sp-airport-field${!origin ? ' sp-field-dim' : ''}`}
              ref={destFieldRef}
              onClick={() => { if (origin) { animFieldPress(destFieldRef); setDestDropdownOpen(v => !v); } }}>
              <div className="sp-lbl">
                <i className="fa-solid fa-plane-arrival" />{t('destination')}
              </div>
              {destination ? (
                <div className="sp-val">
                  <span className="sp-flag">{destination.flag}</span>
                  <div>
                    <div className="sp-code">{destination.code}</div>
                    <div className="sp-city">{destination.city}</div>
                  </div>
                </div>
              ) : (
                <div className="sp-placeholder">
                  {origin ? t('destPlaceholder') : t('selectOriginFirst')}
                </div>
              )}

              {destDropdownOpen && origin && (
                <div className="sp-drop" ref={destDropRef}>
                  <div className="sp-drop-search">
                    <i className="fa-solid fa-magnifying-glass" />
                    <input
                      type="text"
                      placeholder={t('searchAirport')}
                      value={destSearchTerm}
                      autoFocus
                      onChange={(e) => {
                        const v = e.target.value;
                        setDestSearchTerm(v);
                        if (!v.trim()) { setDestination(null); setStartDate(''); setEndDate(''); }
                      }}
                    />
                  </div>
                  <div className="sp-drop-list">
                    {destFiltered.map(ap => (
                      <div key={ap.code} className="sp-drop-item"
                        onClick={(e) => { e.stopPropagation(); selectDestination(ap); }}>
                        <span className="sp-di-flag">{ap.flag}</span>
                        <div className="sp-di-info">
                          <div className="sp-di-city">{ap.city}</div>
                          <div className="sp-di-name">{ap.name.substring(0, 26)}</div>
                        </div>
                        <span className="sp-di-code">{ap.code}</span>
                      </div>
                    ))}
                    {destFiltered.length === 0 && (
                      <div className="sp-drop-empty">{t('noDestinations')}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Row 2: dates + search ── */}
          <div className="sp-row sp-row-bottom">

            {/* Departure */}
            <div className="sp-field sp-date-field" ref={startFieldRef}
              onClick={() => animFieldPress(startFieldRef)}>
              <div className="sp-lbl">
                <i className="fa-solid fa-calendar" />{t('departureDateLabel')}
              </div>
              <div className="sp-val sp-date-val">
                {startDate
                  ? <span className="sp-date-main">{formatDate(startDate)}</span>
                  : <span className="sp-placeholder">—</span>
                }
              </div>
              <input ref={startDateRef} type="date" className="sp-date-hidden"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={(dateRange.min || '').substring(0, 10) || '2026-03-01'}
                max={(dateRange.max || '').substring(0, 10) || '2026-12-31'}
              />
            </div>

            <div className="sp-line" />

            {/* Return */}
            <div className="sp-field sp-date-field" ref={endFieldRef}
              onClick={() => animFieldPress(endFieldRef)}>
              <div className="sp-lbl">
                <i className="fa-solid fa-calendar-check" />{t('returnDateLabel')}
              </div>
              <div className="sp-val sp-date-val">
                {endDate
                  ? <span className="sp-date-main">{formatDate(endDate)}</span>
                  : <span className="sp-placeholder">{t('optional')}</span>
                }
              </div>
              <input ref={endDateRef} type="date" className="sp-date-hidden"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || (dateRange.min || '').substring(0, 10) || '2026-03-01'}
                max={(dateRange.max || '').substring(0, 10) || '2026-12-31'}
              />
            </div>

            {/* Search button */}
            <button ref={searchBtnRef} className="sp-btn" onClick={handleSearch} disabled={loading}>
              {loading
                ? <><i className="fa-solid fa-circle-notch fa-spin" />{t('searching')}</>
                : <><i className="fa-solid fa-magnifying-glass" />{t('search')}</>
              }
            </button>
          </div>
        </div>

        {/* Available dates hint */}
        {origin && destination && dateRange.min && (
          <div className="h2-date-hint">
            <i className="fa-solid fa-calendar-days" />
            {t('availableDates', { min: formatDate(dateRange.min), max: formatDate(dateRange.max) })}
          </div>
        )}

        {/* Stats */}
        <div className="h2-stats" ref={statsRef}>
          <div className="h2-stat">
            <span className="h2-stat-n">147</span>
            <span className="h2-stat-l">{t('heroStatRoutes')}</span>
          </div>
          <div className="h2-stat-div" />
          <div className="h2-stat">
            <span className="h2-stat-n">3</span>
            <span className="h2-stat-l">{t('heroStatNodes')}</span>
          </div>
          <div className="h2-stat-div" />
          <div className="h2-stat">
            <span className="h2-stat-n">15</span>
            <span className="h2-stat-l">{t('heroStatAirports')}</span>
          </div>
        </div>
      </div>

      {/* ══════════════════ RESULTS ══════════════════ */}
      {searched && (
        <div ref={resultsRef} style={{ paddingBottom: '80px', scrollMarginTop: '20px' }}>
          <div className="results-header">
            <div>
              <div className="results-count">
                <span>{totalResults.toLocaleString()}</span>{' '}
                {totalResults === 1 ? t('flightsFound') : t('flightsFoundPlural')}
              </div>
              {origin && destination && (
                <p className="h-sub" style={{ marginTop: '5px' }}>
                  <span className="h-sub-dot" />
                  {origin.flag} {origin.code} → {destination.flag} {destination.code}
                  {startDate ? ` · ${formatDate(startDate)}` : ''}
                  {' · '}{t('pricesUSD')}
                </p>
              )}
            </div>
            {totalPages > 1 && (
              <div className="pagination-row">
                <button className="page-btn" onClick={() => goToPage(currentPage - 1)} disabled={!hasPrev}>
                  <i className="fa-solid fa-arrow-left" style={{ fontSize: '.7rem' }} /> {t('prev')}
                </button>
                <span className="page-info">{currentPage} / {totalPages}</span>
                <button className="page-btn" onClick={() => goToPage(currentPage + 1)} disabled={!hasNext}>
                  {t('next')} <i className="fa-solid fa-arrow-right" style={{ fontSize: '.7rem' }} />
                </button>
              </div>
            )}
          </div>

          {flights.length > 0 ? (
            <div className="flight-list" ref={flightListRef}>
              {flights.map((flight) => (
                <div key={flight.id} className="flight-card" onClick={() => onFlightSelect(flight)}>
                  <div className="fc-airline"><i className="fa-solid fa-plane" /></div>
                  <div className="fc-route">
                    <div style={{ textAlign: 'center' }}>
                      <div className="fc-code">{flight.origin_code}</div>
                      <div className="fc-flag">{COUNTRY_FLAGS[getCountry(flight.origin_code)] || '🌍'}</div>
                      <div className="fc-time">{formatTime(flight.departure_time)}</div>
                    </div>
                    <div className="fc-line">
                      <div className="fc-line-bar">
                        <div className="fc-dash" /><i className="fa-solid fa-plane" /><div className="fc-dash" />
                      </div>
                      <div className="fc-num">{flight.flight_number}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div className="fc-code">{flight.destination_code}</div>
                      <div className="fc-flag">{COUNTRY_FLAGS[getCountry(flight.destination_code)] || '🌍'}</div>
                      <div className="fc-time">{formatTime(flight.arrival_time || '--:--')}</div>
                    </div>
                  </div>
                  <div className="fc-meta">
                    <p><i className="fa-solid fa-calendar" />{formatDate(flight.departure_date)}</p>
                    <p><i className="fa-solid fa-door-open" />{t('gate')} {flight.gate || 'TBD'}</p>
                  </div>
                  <div className="fc-right">
                    <div className="fc-status">
                      <div className="fc-status-dot" />{flight.status || t('scheduled')}
                    </div>
                    <div className="fc-from">{t('from')}</div>
                    <div className="fc-price">${flight.economy_price || 250}</div>
                    <button className="fc-btn"
                      onClick={(e) => { e.stopPropagation(); onFlightSelect(flight); }}>
                      {t('select')}
                      <i className="fa-solid fa-arrow-right" style={{ fontSize: '.65rem' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="state-box">
              <i className="fa-solid fa-plane-slash" style={{ color: 'var(--t2)' }} />
              <p style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--text)' }}>{t('noFlightsFound')}</p>
              <p>{t('tryOtherDates')}{dateRange.min ? ` — ${formatDate(dateRange.min)} / ${formatDate(dateRange.max)}` : ''}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
