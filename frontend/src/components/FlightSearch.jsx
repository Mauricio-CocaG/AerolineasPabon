import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { gsap } from 'gsap';
import ItineraryBooking from './ItineraryBooking';

/* ─── country flags ─────────────────────────────── */
const COUNTRY_FLAGS = {
  USA: '🇺🇸', CHINA: '🇨🇳', UAE: '🇦🇪', JAPAN: '🇯🇵',
  UK: '🇬🇧', FRANCE: '🇫🇷', GERMANY: '🇩🇪', TURKEY: '🇹🇷',
  SINGAPORE: '🇸🇬', SPAIN: '🇪🇸', NETHERLANDS: '🇳🇱', BRAZIL: '🇧🇷',
};

/* ─── información completa de aeropuertos ───────── */
const AIRPORT_INFO = {
  ATL: { city: 'Atlanta', country: 'USA', flag: '🇺🇸', name: 'Hartsfield-Jackson Atlanta International' },
  PEK: { city: 'Beijing', country: 'CHINA', flag: '🇨🇳', name: 'Beijing Capital International' },
  DXB: { city: 'Dubai', country: 'UAE', flag: '🇦🇪', name: 'Dubai International' },
  TYO: { city: 'Tokyo', country: 'JAPAN', flag: '🇯🇵', name: 'Tokyo Haneda International' },
  LON: { city: 'London', country: 'UK', flag: '🇬🇧', name: 'London Heathrow' },
  LAX: { city: 'Los Angeles', country: 'USA', flag: '🇺🇸', name: 'Los Angeles International' },
  PAR: { city: 'Paris', country: 'FRANCE', flag: '🇫🇷', name: 'Charles de Gaulle' },
  FRA: { city: 'Frankfurt', country: 'GERMANY', flag: '🇩🇪', name: 'Frankfurt Airport' },
  IST: { city: 'Istanbul', country: 'TURKEY', flag: '🇹🇷', name: 'Istanbul Airport' },
  SIN: { city: 'Singapore', country: 'SINGAPORE', flag: '🇸🇬', name: 'Singapore Changi' },
  MAD: { city: 'Madrid', country: 'SPAIN', flag: '🇪🇸', name: 'Madrid-Barajas' },
  AMS: { city: 'Amsterdam', country: 'NETHERLANDS', flag: '🇳🇱', name: 'Amsterdam Schiphol' },
  DFW: { city: 'Dallas', country: 'USA', flag: '🇺🇸', name: 'Dallas/Fort Worth' },
  CAN: { city: 'Guangzhou', country: 'CHINA', flag: '🇨🇳', name: 'Guangzhou Baiyun' },
  SAO: { city: 'São Paulo', country: 'BRAZIL', flag: '🇧🇷', name: 'São Paulo Guarulhos' },
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
      logW = canvas.offsetWidth || 800;
      logH = canvas.offsetHeight || 600;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = logW * dpr;
      canvas.height = logH * dpr;
      ctx.scale(dpr, dpr);
      mkStars(logW, logH);
    };

    resize();

    const draw = () => {
      if (!logW || !logH) { raf = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, logW, logH);

      const px = logW * 0.64;
      const py = logH * 0.42;
      const pr = Math.min(logW, logH) * 0.30;

      if (planetDataRef) planetDataRef.current = { x: px, y: py, r: pr };

      stars.forEach(s => {
        s.ph += s.sp;
        const a = s.base * (0.62 + 0.38 * Math.sin(s.ph));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`;
        ctx.fill();
      });

      const glow = ctx.createRadialGradient(px, py, pr * 0.72, px, py, pr * 1.6);
      glow.addColorStop(0, 'rgba(55,105,255,0.24)');
      glow.addColorStop(0.4, 'rgba(55,105,255,0.08)');
      glow.addColorStop(1, 'rgba(55,105,255,0)');
      ctx.beginPath();
      ctx.arc(px, py, pr * 1.6, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      const base = ctx.createRadialGradient(
        px - pr * 0.38, py - pr * 0.34, pr * 0.02,
        px + pr * 0.14, py + pr * 0.20, pr * 1.06
      );
      base.addColorStop(0, '#5092ff');
      base.addColorStop(0.20, '#2357c6');
      base.addColorStop(0.48, '#102c70');
      base.addColorStop(0.76, '#07183c');
      base.addColorStop(1, '#020c1e');
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = base;
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, pr - 0.5, 0, Math.PI * 2);
      ctx.clip();

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

      const lr = (rotation % 360) * Math.PI / 180;
      const blobs = [
        { ox: 0.26, oy: -0.22, rx: 0.20, ry: 0.13, r: lr + 0.4 },
        { ox: -0.30, oy: 0.14, rx: 0.22, ry: 0.12, r: lr + 1.3 },
        { ox: 0.06, oy: 0.30, rx: 0.17, ry: 0.10, r: lr + 2.6 },
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

      const rim = ctx.createRadialGradient(px, py, pr * 0.80, px, py, pr);
      rim.addColorStop(0, 'rgba(75,130,255,0)');
      rim.addColorStop(0.68, 'rgba(75,130,255,0.05)');
      rim.addColorStop(0.88, 'rgba(110,165,255,0.18)');
      rim.addColorStop(1, 'rgba(150,200,255,0.33)');
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = rim;
      ctx.fill();

      const spec = ctx.createRadialGradient(
        px - pr * 0.40, py - pr * 0.36, 0,
        px - pr * 0.20, py - pr * 0.15, pr * 0.60
      );
      spec.addColorStop(0, 'rgba(255,255,255,0.19)');
      spec.addColorStop(0.45, 'rgba(255,255,255,0.05)');
      spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = spec;
      ctx.fill();

      const term = ctx.createRadialGradient(
        px + pr * 0.54, py + pr * 0.16, 0,
        px + pr * 0.18, py + pr * 0.06, pr * 0.95
      );
      term.addColorStop(0, 'rgba(2,6,18,0.80)');
      term.addColorStop(0.45, 'rgba(2,6,18,0.40)');
      term.addColorStop(1, 'rgba(2,6,18,0)');
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
    const orbits = [
      { ra: 1.50, rb: 0.36, tilt: -0.28, speed: 0.0075, phase: 0.0 },
      { ra: 1.24, rb: 0.45, tilt: 0.58, speed: -0.0058, phase: 2.1 },
      { ra: 1.68, rb: 0.21, tilt: 1.22, speed: 0.0048, phase: 4.3 },
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

        const dvx = -(orb.ra * pr * sinA * cosT) - (orb.rb * pr * cosA * sinT);
        const dvy = -(orb.ra * pr * sinA * sinT) + (orb.rb * pr * cosA * cosT);
        const rot = Math.atan2(dvy, dvx) * 180 / Math.PI;

        const inFront = sinA > 0;
        const half = SIZES[i] / 2;

        el.style.transform = `translate(${(x - half).toFixed(1)}px,${(y - half).toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`;
        el.style.opacity = inFront ? '1' : '0.18';
        el.style.zIndex = inFront ? '12' : '2';
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
  const { t } = useTranslation();

  const [originAirports, setOriginAirports] = useState([]);
  const [destinationAirports, setDestinationAirports] = useState([]);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [routeOptions, setRouteOptions] = useState(null);
  const [directFlights, setDirectFlights] = useState([]);

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [dateRange, setDateRange] = useState({ min: '', max: '' });

  const [originDropdownOpen, setOriginDropdownOpen] = useState(false);
  const [destDropdownOpen, setDestDropdownOpen] = useState(false);
  const [originSearchTerm, setOriginSearchTerm] = useState('');
  const [destSearchTerm, setDestSearchTerm] = useState('');
  const [originFiltered, setOriginFiltered] = useState([]);
  const [destFiltered, setDestFiltered] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  const [selectedItinerary, setSelectedItinerary] = useState(null);
  const [selectedItineraryLabel, setSelectedItineraryLabel] = useState('');

  const heroRef = useRef(null);
  const eyebrowRef = useRef(null);
  const titleRef = useRef(null);
  const subRef = useRef(null);
  const panelRef = useRef(null);
  const statsRef = useRef(null);
  const planetDataRef = useRef(null);
  const originRef = useRef(null);
  const destRef = useRef(null);
  const searchBtnRef = useRef(null);
  const flightListRef = useRef(null);
  const resultsRef = useRef(null);

  const getAirportInfo = (code) => {
    return AIRPORT_INFO[code] || { city: code, country: '', flag: '🌍', name: `${code} Airport` };
  };

  const mapAirportCodes = (codes = []) =>
    codes.map((code) => ({
      code,
      name: getAirportInfo(code).name,
      city: getAirportInfo(code).city,
      country: getAirportInfo(code).country,
      flag: getAirportInfo(code).flag
    }));

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

  useEffect(() => {
    if (flightListRef.current && directFlights.length > 0) {
      gsap.fromTo(
        flightListRef.current.querySelectorAll('.flight-card'),
        { opacity: 0, y: 22, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.45, stagger: 0.06, ease: 'back.out(1.2)', delay: 0.1 }
      );
    }
  }, [directFlights]);

  const animBtnPress = (ref) => {
    if (!ref?.current) return;
    gsap.timeline()
      .to(ref.current, { scale: 0.93, y: 2, duration: 0.09, ease: 'power2.in' })
      .to(ref.current, { scale: 1, y: 0, duration: 0.35, ease: 'back.out(2)' });
  };

  // Cargar orígenes válidos
  useEffect(() => {
    const fetchOrigins = async () => {
      try {
        const response = await axios.get(`${API_URL}/flights/valid-origins`);
        if (response.data.success) {
          setOriginAirports(mapAirportCodes(response.data.origins || []));
        }
      } catch (error) {
        console.error('Error fetching valid origins:', error);
      }
    };
    fetchOrigins();
  }, [API_URL]);

  // Cargar destinos ALCANZABLES usando Dijkstra
  const fetchDestinations = async () => {
    if (!origin) {
      setDestinationAirports([]);
      setDestination(null);
      return;
    }

    try {
      const response = await axios.get(`${API_URL}/flights/destinations`, {
        params: { origin: origin.code }
      });

      if (response.data.success) {
        const airportList = response.data.destinations.map(dest => ({
          code: dest.code,
          name: getAirportInfo(dest.code).name,
          city: getAirportInfo(dest.code).city,
          country: getAirportInfo(dest.code).country,
          flag: getAirportInfo(dest.code).flag,
          totalCost: dest.totalCost,
          totalTime: dest.totalTime,
          stops: dest.stops,
          route: dest.route || []
        }));
        setDestinationAirports(airportList);
      } else {
        setDestinationAirports([]);
      }
    } catch (error) {
      console.error('Error fetching reachable destinations:', error);
      setDestinationAirports([]);
    }
  };

  useEffect(() => {
    fetchDestinations();
  }, [API_URL, origin]);

  useEffect(() => {
    if (origin && destination) {
      fetchAvailableDates();
    } else {
      setDateRange({ min: '', max: '' });
      setStartDate('');
      setEndDate('');
    }
  }, [origin, destination]);

  useEffect(() => {
    const filtered = originAirports
      .filter(
        (a) =>
          (!destination || a.code !== destination.code) &&
          (a.code.toLowerCase().includes(originSearchTerm.toLowerCase()) ||
           a.city.toLowerCase().includes(originSearchTerm.toLowerCase()))
      )
      .slice(0, 8);
    setOriginFiltered(filtered);
  }, [originSearchTerm, originAirports, destination]);

  useEffect(() => {
    const filtered = destinationAirports
      .filter(
        (a) =>
          (!origin || a.code !== origin.code) &&
          (a.code.toLowerCase().includes(destSearchTerm.toLowerCase()) ||
           a.city.toLowerCase().includes(destSearchTerm.toLowerCase()))
      )
      .slice(0, 8);
    setDestFiltered(filtered);
  }, [destSearchTerm, destinationAirports, origin]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (originRef.current && !originRef.current.contains(event.target)) {
        setOriginDropdownOpen(false);
      }
      if (destRef.current && !destRef.current.contains(event.target)) {
        setDestDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAvailableDates = async () => {
    try {
      const response = await axios.get(`${API_URL}/flights/available-dates`, {
        params: { origin: origin.code, destination: destination.code }
      });

      if (response.data.success && response.data.dates.length > 0) {
        setDateRange({
          min: response.data.minDate,
          max: response.data.maxDate
        });
        if (!startDate) setStartDate(response.data.minDate);
        if (!endDate) setEndDate(response.data.maxDate);
      }
    } catch (error) {
      console.error('Error fetching available dates:', error);
    }
  };

  const searchRouteOptions = async (page = 1) => {
    if (!origin || !destination) {
      setRouteOptions(null);
      setDirectFlights([]);
      setSearched(true);
      return;
    }

    setLoading(true);

    try {
      const routeResponse = await axios.get(`${API_URL}/routes/options`, {
        params: {
          origin: origin.code,
          destination: destination.code
        }
      });

      if (routeResponse.data.success) {
        setRouteOptions(routeResponse.data);

        const cheapestRoute = routeResponse.data.cheapest;
        const isDirectRoute =
          cheapestRoute &&
          cheapestRoute.found &&
          Array.isArray(cheapestRoute.route) &&
          cheapestRoute.route.length === 1;

        if (isDirectRoute) {
          const params = {
            origin: origin.code,
            destination: destination.code,
            page,
            limit: 20
          };
          if (startDate) params.startDate = startDate;
          if (endDate) params.endDate = endDate;

          const flightsResponse = await axios.get(`${API_URL}/flights`, { params });

          if (flightsResponse.data.success) {
            setDirectFlights(flightsResponse.data.data);
            setCurrentPage(flightsResponse.data.pagination.page);
            setTotalPages(flightsResponse.data.pagination.pages);
            setTotalResults(flightsResponse.data.pagination.total);
            setHasNext(flightsResponse.data.pagination.hasNext);
            setHasPrev(flightsResponse.data.pagination.hasPrev);
          } else {
            setDirectFlights([]);
            setTotalResults(0);
          }
        } else {
          setDirectFlights([]);
          setCurrentPage(1);
          setTotalPages(0);
          setTotalResults(0);
          setHasNext(false);
          setHasPrev(false);
        }
      } else {
        setRouteOptions(null);
        setDirectFlights([]);
        setTotalResults(0);
      }

      setSelectedItinerary(null);
      setSelectedItineraryLabel('');
      setSearched(true);
      
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    } catch (error) {
      console.error('Error searching route options:', error);
      setRouteOptions(null);
      setDirectFlights([]);
      setTotalResults(0);
      setSelectedItinerary(null);
      setSelectedItineraryLabel('');
      setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    animBtnPress(searchBtnRef);
    setCurrentPage(1);
    searchRouteOptions(1);
  };

  const goToPage = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      searchRouteOptions(newPage);
    }
  };

  const swapLocations = () => {
    if (!origin && !destination) return;

    const oldOrigin = origin;
    const oldDestination = destination;

    setOrigin(oldDestination || null);
    setDestination(oldOrigin || null);

    setOriginSearchTerm(oldDestination ? oldDestination.code : '');
    setDestSearchTerm(oldOrigin ? oldOrigin.code : '');

    setStartDate('');
    setEndDate('');
    setDateRange({ min: '', max: '' });
    setRouteOptions(null);
    setDirectFlights([]);
    setSearched(false);
    setSelectedItinerary(null);
    setSelectedItineraryLabel('');
  };

  const selectOrigin = (airport) => {
    setOrigin(airport);
    setOriginSearchTerm(airport.city);
    setOriginDropdownOpen(false);

    if (!destination || destination.code === airport.code) {
      setDestination(null);
      setDestSearchTerm('');
    }

    setStartDate('');
    setEndDate('');
    setDateRange({ min: '', max: '' });
    setRouteOptions(null);
    setDirectFlights([]);
    setSearched(false);
    setSelectedItinerary(null);
    setSelectedItineraryLabel('');
  };

  const selectDestination = (airport) => {
    setDestination(airport);
    setDestSearchTerm(airport.city);
    setDestDropdownOpen(false);
    setStartDate('');
    setEndDate('');
    setRouteOptions(null);
    setDirectFlights([]);
    setSearched(false);
    setSelectedItinerary(null);
    setSelectedItineraryLabel('');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    return String(timeStr).substring(0, 5);
  };

  const formatMoney = (amount) => {
    return `$${Number(amount || 0).toLocaleString()}`;
  };

  const formatDuration = (hours) => {
    const totalHours = Number(hours || 0);
    const h = Math.floor(totalHours);
    const m = Math.round((totalHours - h) * 60);
    return m > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`;
  };

  const openItineraryBooking = (routeObj, label) => {
    setSelectedItinerary(routeObj);
    setSelectedItineraryLabel(label);
  };

  const renderRouteSummary = (routeObj, title) => {
    if (!routeObj || !routeObj.found) return null;

    const isDirect = Array.isArray(routeObj.route) && routeObj.route.length === 1;

    return (
      <div className="route-summary-card" style={{
        padding: '18px',
        background: 'var(--surface)',
        borderRadius: '20px',
        boxShadow: 'var(--sh2)',
        marginBottom: '14px',
        border: '1px solid var(--border)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: 'var(--text)', marginBottom: '8px' }}>{title}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--blue)', fontWeight: 700, marginBottom: '10px' }}>
              {routeObj.origin} → {routeObj.destination}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
              <span className="route-badge">
                {routeObj.stops === 0 ? 'Directo' : `${routeObj.stops} escala(s)`}
              </span>
              <span className="route-badge time">
                Tiempo total: {formatDuration(routeObj.totalTime)}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {routeObj.route.map((segment, index) => (
                <div key={`${segment.from}-${segment.to}-${index}`} className="segment-item">
                  <div style={{ fontWeight: 700, color: 'var(--text)' }}>
                    {segment.from} → {segment.to}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--t2)' }}>
                    {formatMoney(segment.cost)} · {formatDuration(segment.time)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ minWidth: '180px', textAlign: 'right' }}>
            <div className="price-label">Precio total</div>
            <div className="price-value">{formatMoney(routeObj.totalCost)}</div>

            {routeObj.route.length > 1 ? (
              <div className="route-type multi">Ruta con escalas</div>
            ) : (
              <div className="route-type direct">Ruta directa</div>
            )}

            {!isDirect && (
              <button type="button" className="select-itinerary-btn" onClick={() => openItineraryBooking(routeObj, title)}>
                Seleccionar itinerario
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (selectedItinerary) {
    return (
      <ItineraryBooking
        apiUrl={API_URL}
        routeOption={selectedItinerary}
        startDate={startDate}
        endDate={endDate}
        classType="ECONOMY"
        onCancel={() => {
          setSelectedItinerary(null);
          setSelectedItineraryLabel('');
        }}
        onComplete={(result) => {
          if (onFlightSelect) {
            onFlightSelect({
              type: 'itinerary',
              label: selectedItineraryLabel,
              route: selectedItinerary,
              result
            });
          }
        }}
      />
    );
  }

  return (
    <div>
      <div className="hero2" ref={heroRef}>
        <SpaceBackground planetDataRef={planetDataRef} />
        <OrbitingPlanes planetDataRef={planetDataRef} />
        <div className="h2-grid" />

        <div className="h2-top">
          <div className="h2-eyebrow" ref={eyebrowRef}>
            <i className="fa-solid fa-globe" />
            {t('heroEyebrow') || 'Explora el mundo'}
          </div>

          <div ref={titleRef} className="h2-title-wrap">
            <h1 className="h2-h1">{t('heroTitleMain') || 'Vuela al'} </h1>
            <h1 className="h2-h1 h2-accent">{t('heroTitleAccent') || 'Futuro'}</h1>
          </div>

          <p className="h2-sub" ref={subRef}>
            {t('heroSub') || 'Encuentra los mejores vuelos con nuestro sistema distribuido'}
          </p>
        </div>

        <div className="sp-panel" ref={panelRef}>
          <div className="sp-row">
            {/* Origin Field */}
            <div className="sp-field sp-airport-field" ref={originRef}>
              <div className="sp-lbl">
                <i className="fa-solid fa-plane-departure" />
                {t('origin') || 'Origen'}
              </div>

              <div className="airport-selector" onClick={() => { setOriginDropdownOpen(!originDropdownOpen); if (origin) setOriginSearchTerm(origin.city); }}>
                {origin ? (
                  <div className="sp-val">
                    <span className="sp-flag">{origin.flag}</span>
                    <div>
                      <div className="sp-code">{origin.code}</div>
                      <div className="sp-city">{origin.city}, {origin.country}</div>
                    </div>
                  </div>
                ) : (
                  <div className="sp-placeholder">{t('originPlaceholder') || '¿Desde dónde?'}</div>
                )}
              </div>

              {originDropdownOpen && (
                <div className="sp-drop">
                  <div className="sp-drop-search">
                    <i className="fa-solid fa-magnifying-glass" />
                    <input type="text" placeholder="Buscar ciudad o aeropuerto..." value={originSearchTerm} autoFocus
                      onChange={(e) => {
                        const value = e.target.value;
                        setOriginSearchTerm(value);
                        if (value.trim() === '') {
                          setOrigin(null);
                          setDestination(null);
                          setDestinationAirports([]);
                          setDestSearchTerm('');
                          setStartDate('');
                          setEndDate('');
                          setDateRange({ min: '', max: '' });
                          setRouteOptions(null);
                          setDirectFlights([]);
                          setSearched(false);
                          setSelectedItinerary(null);
                          setSelectedItineraryLabel('');
                        }
                      }}
                    />
                  </div>
                  <div className="sp-drop-list">
                    {originFiltered.map((airport) => (
                      <div key={airport.code} className="sp-drop-item" onClick={() => selectOrigin(airport)}>
                        <span className="sp-di-flag">{airport.flag}</span>
                        <div className="sp-di-info">
                          <div className="sp-di-city">{airport.city}</div>
                          <div className="sp-di-name">{airport.country}</div>
                        </div>
                        <span className="sp-di-code">{airport.code}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Swap Button */}
            <div className="sp-sep">
              <button className="sp-swap" onClick={swapLocations} title="Swap">
                <i className="fa-solid fa-arrow-right-arrow-left" />
              </button>
            </div>

            {/* Destination Field */}
            <div className={`sp-field sp-airport-field ${!origin ? 'sp-field-dim' : ''}`} ref={destRef}>
              <div className="sp-lbl">
                <i className="fa-solid fa-plane-arrival" />
                {t('destination') || 'Destino'}
              </div>

              <div className={`airport-selector ${!origin ? 'disabled' : ''}`} onClick={() => { if (origin) { setDestDropdownOpen(!destDropdownOpen); if (destination) setDestSearchTerm(destination.city); } }}>
                {destination ? (
                  <div className="sp-val">
                    <span className="sp-flag">{destination.flag}</span>
                    <div>
                      <div className="sp-code">{destination.code}</div>
                      <div className="sp-city">{destination.city}, {destination.country}</div>
                      <div className="sp-stops">{destination.stops === 0 ? '✈️ Directo' : `🛑 ${destination.stops} escala(s)`}</div>
                    </div>
                  </div>
                ) : (
                  <div className="sp-placeholder">
                    {origin ? (t('destPlaceholder') || '¿A dónde?') : 'Primero selecciona un origen'}
                  </div>
                )}
              </div>

              {destDropdownOpen && origin && (
                <div className="sp-drop">
                  <div className="sp-drop-search">
                    <i className="fa-solid fa-magnifying-glass" />
                    <input type="text" placeholder="Buscar ciudad o aeropuerto..." value={destSearchTerm} autoFocus
                      onChange={(e) => {
                        const value = e.target.value;
                        setDestSearchTerm(value);
                        if (value.trim() === '') {
                          setDestination(null);
                          setStartDate('');
                          setEndDate('');
                          setRouteOptions(null);
                          setDirectFlights([]);
                          setSearched(false);
                          setSelectedItinerary(null);
                          setSelectedItineraryLabel('');
                        }
                      }}
                    />
                  </div>
                  <div className="sp-drop-list">
                    {destFiltered.length > 0 ? (
                      destFiltered.map((airport) => (
                        <div key={airport.code} className="sp-drop-item" onClick={() => selectDestination(airport)}>
                          <span className="sp-di-flag">{airport.flag}</span>
                          <div className="sp-di-info">
                            <div className="sp-di-city">{airport.city}</div>
                            <div className="sp-di-name">{airport.country}</div>
                            <div className="sp-di-stops">{airport.stops === 0 ? 'Directo' : `${airport.stops} escala(s)`}</div>
                          </div>
                          <span className="sp-di-code">{formatMoney(airport.totalCost)}</span>
                        </div>
                      ))
                    ) : (
                      <div className="sp-drop-empty">No hay destinos disponibles para ese origen</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="sp-row sp-row-bottom">
            {/* Departure Date */}
            <div className="sp-field sp-date-field">
              <div className="sp-lbl">
                <i className="fa-solid fa-calendar" />
                Fecha de Ida
              </div>
              <div className="sp-date-val">
                <input type="date" className="date-input-clean" value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={dateRange.min || '2026-03-01'}
                  max={dateRange.max || '2026-04-30'}
                />
              </div>
            </div>

            <div className="sp-line" />

            {/* Return Date */}
            <div className="sp-field sp-date-field">
              <div className="sp-lbl">
                <i className="fa-solid fa-calendar-check" />
                Fecha de Vuelta (opcional)
              </div>
              <div className="sp-date-val">
                <input type="date" className="date-input-clean" value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || dateRange.min || '2026-03-01'}
                  max={dateRange.max || '2026-04-30'}
                />
              </div>
            </div>

            {/* Search Button */}
            <button ref={searchBtnRef} className="sp-btn" onClick={handleSearch} disabled={loading}>
              {loading ? (
                <><i className="fa-solid fa-circle-notch fa-spin" /> Buscando...</>
              ) : (
                <><i className="fa-solid fa-magnifying-glass" /> {t('search') || 'Buscar Vuelos'}</>
              )}
            </button>
          </div>
        </div>

        {origin && destination && dateRange.min && (
          <div className="h2-date-hint">
            <i className="fa-solid fa-calendar-days" />
            Vuelos disponibles entre {formatDate(dateRange.min)} y {formatDate(dateRange.max)}
          </div>
        )}

        <div className="h2-stats" ref={statsRef}>
          <div className="h2-stat">
            <span className="h2-stat-n">147</span>
            <span className="h2-stat-l">Rutas</span>
          </div>
          <div className="h2-stat-div" />
          <div className="h2-stat">
            <span className="h2-stat-n">3</span>
            <span className="h2-stat-l">Nodos</span>
          </div>
          <div className="h2-stat-div" />
          <div className="h2-stat">
            <span className="h2-stat-n">15</span>
            <span className="h2-stat-l">Aeropuertos</span>
          </div>
        </div>
      </div>

      {searched && (
        <div ref={resultsRef} className="results-section">
          <div className="results-header">
            <div>
              <div className="results-count">
                <span>{totalResults.toLocaleString()}</span> {totalResults === 1 ? 'vuelo encontrado' : 'vuelos encontrados'}
              </div>
              {origin && destination && (
                <p className="h-sub">
                  <span className="h-sub-dot" />
                  {origin.flag} {origin.code} ({origin.city}) → {destination.flag} {destination.code} ({destination.city})
                  {startDate ? ` · ${formatDate(startDate)}` : ''}
                </p>
              )}
            </div>
            {totalPages > 1 && (
              <div className="pagination-row">
                <button className="page-btn" onClick={() => goToPage(currentPage - 1)} disabled={!hasPrev}>
                  <i className="fa-solid fa-arrow-left" /> Anterior
                </button>
                <span className="page-info">{currentPage} / {totalPages}</span>
                <button className="page-btn" onClick={() => goToPage(currentPage + 1)} disabled={!hasNext}>
                  Siguiente <i className="fa-solid fa-arrow-right" />
                </button>
              </div>
            )}
          </div>

          {routeOptions?.success && (
            <div className="route-summaries">
              {renderRouteSummary(routeOptions.cheapest, 'Ruta más barata')}
              {routeOptions.fastest && routeOptions.cheapest && JSON.stringify(routeOptions.fastest.route) !== JSON.stringify(routeOptions.cheapest.route) && renderRouteSummary(routeOptions.fastest, 'Ruta más rápida')}
            </div>
          )}

          {directFlights.length > 0 ? (
            <div className="flight-list" ref={flightListRef}>
              {directFlights.map((flight) => (
                <div key={flight.id} className="flight-card" onClick={() => onFlightSelect(flight)}>
                  <div className="fc-airline"><i className="fa-solid fa-plane" /></div>
                  <div className="fc-route">
                    <div style={{ textAlign: 'center' }}>
                      <div className="fc-code">{flight.origin_code}</div>
                      <div className="fc-time">{formatTime(flight.departure_time)}</div>
                      <div className="fc-city">{getAirportInfo(flight.origin_code).city}</div>
                    </div>
                    <div className="fc-line">
                      <div className="fc-line-bar"><div className="fc-dash" /><i className="fa-solid fa-plane" /><div className="fc-dash" /></div>
                      <div className="fc-num">{flight.flight_number}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div className="fc-code">{flight.destination_code}</div>
                      <div className="fc-time">{formatTime(flight.arrival_time || '--:--')}</div>
                      <div className="fc-city">{getAirportInfo(flight.destination_code).city}</div>
                    </div>
                  </div>
                  <div className="fc-meta">
                    <p><i className="fa-solid fa-calendar" />{formatDate(flight.departure_date)}</p>
                    <p><i className="fa-solid fa-door-open" />Puerta {flight.gate || 'TBD'}</p>
                  </div>
                  <div className="fc-right">
                    <div className="fc-status"><div className="fc-status-dot" />{flight.status || 'Programado'}</div>
                    <div className="fc-from">Desde</div>
                    <div className="fc-price">{formatMoney(flight.economy_price || 250)}</div>
                    <button className="fc-btn" onClick={(e) => { e.stopPropagation(); onFlightSelect(flight); }}>Seleccionar <i className="fa-solid fa-arrow-right" /></button>
                  </div>
                </div>
              ))}
            </div>
          ) : routeOptions?.success ? (
            <div className="state-box">
              <i className="fa-solid fa-route" />
              <p>Se encontraron rutas óptimas para este destino.</p>
              <p>Usa el botón <strong>Seleccionar itinerario</strong> en una de las rutas con escalas para continuar.</p>
            </div>
          ) : searched && (
            <div className="state-box">
              <i className="fa-solid fa-plane-slash" />
              <p>No se encontraron rutas para los filtros seleccionados.</p>
              <p>Prueba con otro destino o con fechas entre {dateRange.min || 'marzo'} y {dateRange.max || 'abril'} 2026</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}