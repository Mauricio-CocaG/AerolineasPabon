import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
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

export default function App() {
  const { t } = useTranslation();
  const geo = useGeolocation();
  
  // Estado del nodo seleccionado manualmente
  const [selectedNode, setSelectedNode] = useState(null);
  const [apiUrl, setApiUrl] = useState(geo.apiUrl || 'http://localhost:3001/api/v1');
  const [vectorClock, setVectorClock] = useState(null);
  
  const [activeTab, setActiveTab] = useState('search');
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [bookingResult, setBookingResult] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

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

  const tabs = [
    { id: 'search',    label: t('flights'),    icon: 'fa-plane' },
    { id: 'dashboard', label: t('dashboard'),  icon: 'fa-chart-pie' },
    ...(selectedFlight ? [{ id: 'seats', label: t('seats'), icon: 'fa-chair' }] : []),
  ];

  // Determinar el nodo actual a mostrar
  const currentNode = selectedNode ? NODES[selectedNode] : (geo.node || NODES[1]);

  return (
    <div style={{ minHeight: '100vh', background: '#EBEFFF' }}>

      {/* ── HEADER ── */}
      <header style={{
        background: 'linear-gradient(160deg, #4F73FF 0%, #3960FB 40%, #1A2EB5 75%, #142258 100%)',
        boxShadow: '0 4px 32px rgba(20,34,88,0.45)',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0 10px', flexWrap: 'wrap', gap: '12px' }}>

            {/* Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <i className="fa-solid fa-plane" style={{ color: '#ffffff', fontSize: '16px' }} />
              </div>
              <div>
                <p style={{ color: '#ffffff', fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.1 }}>
                  {t('brandName')}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.62rem', letterSpacing: '0.12em' }}>
                  {t('brandTagline')}
                </p>
              </div>
            </div>

            {/* Selector de Nodos y estado */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{
                display: 'flex',
                background: 'rgba(255,255,255,0.12)',
                borderRadius: '40px',
                padding: '4px',
                gap: '4px'
              }}>
                {Object.entries(NODES).map(([id, node]) => (
                  <button
                    key={id}
                    onClick={() => handleNodeChange(parseInt(id))}
                    style={{
                      padding: '6px 16px',
                      borderRadius: '32px',
                      border: 'none',
                      background: (selectedNode ? selectedNode === parseInt(id) : geo.node?.id === parseInt(id)) ? '#ffffff' : 'transparent',
                      color: (selectedNode ? selectedNode === parseInt(id) : geo.node?.id === parseInt(id)) ? '#142258' : 'rgba(255,255,255,0.8)',
                      fontWeight: 600,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    🌍 {node.name}
                  </button>
                ))}
              </div>
              
              {/* Reloj Vectorial */}
              {vectorClock && (
                <div style={{
                  background: 'rgba(255,255,255,0.12)',
                  borderRadius: '20px',
                  padding: '4px 12px',
                  fontSize: '0.7rem',
                  fontFamily: 'monospace',
                  color: '#ffffff'
                }}>
                  🕐 VC: [{vectorClock.node_1 || 0}, {vectorClock.node_2 || 0}, {vectorClock.node_3 || 0}]
                </div>
              )}
              
              <LanguageSwitcher />
            </div>
          </div>

          {/* Nav tabs */}
          <div style={{ display: 'flex', gap: '4px', paddingBottom: '12px', overflowX: 'auto' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={'nav-pill' + (activeTab === tab.id ? ' active' : '')}
                onClick={() => setActiveTab(tab.id)}
              >
                <i className={`fa-solid ${tab.icon}`} style={{ fontSize: '0.78rem' }} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── WAVE: header → lavender ── */}
      <div style={{ background: 'linear-gradient(160deg, #4F73FF 0%, #3960FB 40%, #1A2EB5 75%, #142258 100%)', lineHeight: 0 }}>
        <svg className="header-wave" viewBox="0 0 1440 56" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M0,32 C240,56 480,8 720,28 C960,48 1200,12 1440,32 L1440,56 L0,56 Z" fill="#EBEFFF"/>
        </svg>
      </div>

      {/* ── MAIN ── */}
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '8px 24px 56px', position: 'relative', zIndex: 1 }}>

        {/* Indicador del nodo activo */}
        <div className="card" style={{ marginBottom: '20px', padding: '12px 20px', background: '#ffffff', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: '#4ADE80', boxShadow: '0 0 8px #4ADE80'
              }} />
              <span style={{ fontWeight: 600, color: '#142258' }}>
                Conectado a: <strong style={{ color: '#3960FB' }}>{currentNode.name}</strong> ({currentNode.country})
              </span>
              <span style={{ fontSize: '0.7rem', color: '#6B7A99' }}>
                API: {currentNode.url}
              </span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#6B7A99' }}>
              <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '4px' }} />
              Reloj Vectorial: [{vectorClock?.node_1 || 0}, {vectorClock?.node_2 || 0}, {vectorClock?.node_3 || 0}]
            </div>
          </div>
        </div>

        {activeTab === 'search' && (
          <div className="fade-up">
            <FlightSearch apiUrl={apiUrl} onFlightSelect={handleFlightSelect} />
          </div>
        )}

        {activeTab === 'seats' && selectedFlight && (
          <div className="fade-up">
            {/* Flight strip */}
            <div className="card" style={{ marginBottom: '20px', padding: '16px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <button className="btn-back" onClick={() => setActiveTab('search')}>
                    <i className="fa-solid fa-arrow-left" />
                    {t('back')}
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#142258' }}>{selectedFlight.origin_code}</span>
                    <div className="route-line" style={{ width: '90px' }}>
                      <div className="route-dot" />
                      <div className="route-dashes" />
                      <i className="fa-solid fa-plane" style={{ color: '#3960FB', fontSize: '0.85rem', flexShrink: 0 }} />
                      <div className="route-dashes" />
                      <div className="route-dot" />
                    </div>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#142258' }}>{selectedFlight.destination_code}</span>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#6B7A99' }}>
                    {selectedFlight.flight_number} &middot; {selectedFlight.departure_date?.substring(0, 10)} &middot; {t('gate')} {selectedFlight.gate}
                  </span>
                </div>
                <span className="tag tag-green">
                  <i className="fa-solid fa-circle-check" style={{ fontSize: '0.65rem' }} />
                  {t('scheduled')}
                </span>
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

        {activeTab === 'booking' && selectedFlight && selectedSeat && (
          <div className="fade-up">
            <BookingForm
              apiUrl={apiUrl}
              flight={selectedFlight}
              seat={selectedSeat}
              onComplete={handleBookingComplete}
              onCancel={() => setActiveTab('seats')}
            />
          </div>
        )}

        {activeTab === 'result' && bookingResult && (
          <div className="fade-up" style={{ maxWidth: '480px', margin: '0 auto' }}>
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

        {activeTab === 'dashboard' && (
          <div className="fade-up">
            {dashboardData
              ? <Dashboard data={dashboardData} />
              : (
                <div className="card" style={{ textAlign: 'center', padding: '56px', color: '#6B7A99' }}>
                  <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '1.5rem', marginBottom: '12px', display: 'block', color: '#3960FB' }} />
                  {t('loadingDashboard')}
                </div>
              )
            }
          </div>
        )}
      </main>

      {/* ── FOOTER ── */}
      <footer className="site-footer">
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

          {/* Top row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', marginBottom: '28px' }}>

            {/* Brand */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fa-solid fa-plane" style={{ color: '#6B8FFF', fontSize: '14px' }} />
              </div>
              <div>
                <p style={{ color: '#fff', fontWeight: 800, fontSize: '0.95rem', lineHeight: 1.2 }}>{t('brandName')}</p>
                <p style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '2px' }}>{t('brandTagline')}</p>
              </div>
            </div>

            {/* Links */}
            <nav style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
              {['Términos de uso', 'Privacidad', 'Soporte', 'Documentación'].map(link => (
                <a key={link} href="#">{link}</a>
              ))}
            </nav>
          </div>

          {/* Divider */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', marginBottom: '20px' }} />

          {/* Bottom row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)' }}>
              &copy; 2026 Aerolineas Pabón &middot; Práctica 3 Sistemas Distribuidos
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Node status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4ADE80', boxShadow: '0 0 5px #4ADE80', flexShrink: 0 }} />
                <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.04em' }}>
                  Nodo {currentNode.name} activo
                </span>
              </div>
              <span style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.15)' }}>
                <i className="fa-solid fa-clock-rotate-left" style={{ marginRight: '5px' }} />
                Vector Clock Sync
              </span>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
}

/* ── Boarding Pass Result Card ── */
function BoardingPassResult({ result, flight, apiUrl, onNew, t }) {
  const [walletQr, setWalletQr] = React.useState(null);
  const [walletViewUrl, setWalletViewUrl] = React.useState(null);
  const [googleWalletUrl, setGoogleWalletUrl] = React.useState(null);
  const [loadingWallet, setLoadingWallet] = React.useState(false);

  if (!result.success) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#FEF2F2', border: '1px solid #FECACA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <i className="fa-solid fa-xmark" style={{ color: '#EF4444', fontSize: '1.5rem' }} />
        </div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#EF4444', marginBottom: '8px' }}>{t('bookingError')}</h2>
        <p style={{ color: '#6B7A99', marginBottom: '24px' }}>{result.message}</p>
        <button className="btn-primary" style={{ width: '100%' }} onClick={onNew}>{t('newBooking')}</button>
      </div>
    );
  }

  const sale = result.sale;
  const isFirst = sale?.class_type === 'FIRST';
  const accent = isFirst ? '#D97706' : '#3960FB';

  const handleWallet = async () => {
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

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

      {/* ── Blue gradient header ── */}
      <div style={{ background: 'linear-gradient(145deg, #3960FB 0%, #0D1D5A 100%)', padding: '22px 26px 20px', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
          <p style={{ fontSize: '0.62rem', letterSpacing: '0.16em', opacity: 0.65, textTransform: 'uppercase' }}>
            <i className="fa-solid fa-ticket" style={{ marginRight: '6px' }} />{t('eBoardingPass')}
          </p>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, opacity: 0.85 }}>{flight?.flight_number}</span>
        </div>

        {/* Route */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p style={{ fontSize: '2.6rem', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>{flight?.origin_code || '—'}</p>
            <p style={{ fontSize: '0.68rem', opacity: 0.55, marginTop: '3px' }}>{t('origin2')}</p>
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', margin: '0 18px', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', width: '100%' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.5)', flexShrink: 0 }} />
              <div style={{ flex: 1, height: '1px', background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.4) 0,rgba(255,255,255,0.4) 4px,transparent 4px,transparent 8px)' }} />
              <i className="fa-solid fa-plane" style={{ fontSize: '0.85rem', opacity: 0.9, flexShrink: 0 }} />
              <div style={{ flex: 1, height: '1px', background: 'repeating-linear-gradient(90deg,rgba(255,255,255,0.4) 0,rgba(255,255,255,0.4) 4px,transparent 4px,transparent 8px)' }} />
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.5)', flexShrink: 0 }} />
            </div>
            <p style={{ fontSize: '0.65rem', opacity: 0.55 }}>{flight?.flight_number}</p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '2.6rem', fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em' }}>{flight?.destination_code || '—'}</p>
            <p style={{ fontSize: '0.68rem', opacity: 0.55, marginTop: '3px' }}>{t('dest2')}</p>
          </div>
        </div>
      </div>

      {/* ── Perforated divider ── */}
      <div style={{ position: 'relative', height: '18px', background: '#EBEFFF', display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: '-10px', width: '20px', height: '20px', borderRadius: '50%', background: '#EBEFFF', zIndex: 2 }} />
        <div style={{ position: 'absolute', right: '-10px', width: '20px', height: '20px', borderRadius: '50%', background: '#EBEFFF', zIndex: 2 }} />
        <div style={{ flex: 1, height: '1.5px', margin: '0 14px', background: 'repeating-linear-gradient(90deg, #C2CEFE 0, #C2CEFE 6px, transparent 6px, transparent 12px)' }} />
      </div>

      {/* ── Details body ── */}
      <div style={{ padding: '18px 26px 22px' }}>

        {/* Info grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '18px' }}>
          {[
            { label: t('class'), value: isFirst ? t('firstClass') : t('economy'), color: accent },
            { label: t('seat'), value: sale?.seat_number, color: '#142258' },
            { label: t('gate'), value: flight?.gate || '—', color: '#142258' },
            { label: t('total'), value: '$' + parseFloat(sale?.price_paid || 0).toLocaleString(), color: accent },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p style={{ fontSize: '0.6rem', fontWeight: 700, color: '#9AAAC2', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '3px' }}>{label}</p>
              <p style={{ fontWeight: 800, color, fontSize: '0.88rem' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Ticket number */}
        <div style={{ background: '#F7F9FF', borderRadius: '10px', padding: '10px 14px', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '0.6rem', fontWeight: 700, color: '#9AAAC2', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>{t('ticket')}</p>
            <p style={{ fontWeight: 700, color: '#142258', fontSize: '0.82rem', letterSpacing: '0.05em' }}>{sale?.ticket_number}</p>
          </div>
          <i className="fa-solid fa-barcode" style={{ color: '#C2CEFE', fontSize: '1.5rem' }} />
        </div>

        {/* Barcode visual */}
        <div className="barcode-visual" style={{ marginBottom: '5px', borderRadius: '4px' }} />
        <p style={{ textAlign: 'center', fontSize: '0.58rem', color: '#B0BBD5', fontWeight: 600, letterSpacing: '0.14em', marginBottom: '20px' }}>
          {sale?.ticket_number}
        </p>

        {/* Action buttons */}
        <button
          className="btn-primary"
          style={{ width: '100%', marginBottom: '10px' }}
          onClick={() => window.open(apiUrl + '/boarding-pass/pdf?ticket=' + sale?.ticket_number, '_blank')}
        >
          <i className="fa-solid fa-file-pdf" />
          {t('download')}
        </button>

        <button
          className="btn-outline"
          style={{ width: '100%', marginBottom: '10px' }}
          onClick={handleWallet}
          disabled={loadingWallet}
        >
          {loadingWallet
            ? <><i className="fa-solid fa-circle-notch fa-spin" />{t('processing')}</>
            : <><i className="fa-solid fa-qrcode" />{walletQr ? 'Ocultar QR Wallet' : t('wallet')}</>
          }
        </button>

        {/* Wallet QR panel */}
        {walletQr && (
          <div style={{ background: 'linear-gradient(160deg,#060818 0%,#0D1B4B 100%)', borderRadius: '18px', padding: '20px', marginBottom: '10px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle,rgba(57,96,251,0.35) 0%,transparent 70%)', pointerEvents: 'none' }} />

            <p style={{ fontSize: '0.62rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '14px', position: 'relative' }}>
              <i className="fa-solid fa-mobile-screen" style={{ marginRight: '6px', color: 'rgba(255,255,255,0.6)' }} />
              Escanear con tu telefono
            </p>

            <div style={{ display: 'inline-block', background: '#ffffff', borderRadius: '14px', padding: '10px', boxShadow: '0 8px 32px rgba(57,96,251,0.4)', position: 'relative', marginBottom: '14px' }}>
              <img src={walletQr} alt="Wallet QR" style={{ width: '220px', height: '220px', display: 'block', borderRadius: '6px' }} />
            </div>

            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)', position: 'relative', lineHeight: 1.5, marginBottom: '14px' }}>
              Escanea para abrir tu pase de abordar digital
            </p>

            {googleWalletUrl && (
              <a
                href={googleWalletUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                  background: '#000', color: '#fff',
                  borderRadius: '12px', padding: '13px 20px',
                  fontSize: '0.88rem', fontWeight: 700,
                  textDecoration: 'none', marginBottom: '10px', position: 'relative',
                  boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
                }}
              >
                <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
                  <path d="M11 0C4.925 0 0 4.925 0 11s4.925 11 11 11 11-4.925 11-11S17.075 0 11 0z" fill="#4285F4"/>
                  <path d="M11 0C4.925 0 0 4.925 0 11h11V0z" fill="#EA4335"/>
                  <path d="M0 11c0 6.075 4.925 11 11 11V11H0z" fill="#34A853"/>
                  <path d="M22 11c0-6.075-4.925-11-11-11v11h11z" fill="#FBBC05"/>
                </svg>
                Guardar en Google Wallet
              </a>
            )}

            {walletViewUrl && (
              <button
                className="btn-outline"
                style={{ fontSize: '0.72rem', padding: '8px 18px', borderColor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.8)', background: 'rgba(255,255,255,0.08)', position: 'relative', width: '100%' }}
                onClick={() => window.open(walletViewUrl, '_blank')}
              >
                <i className="fa-solid fa-arrow-up-right-from-square" />
                Abrir pase digital
              </button>
            )}
          </div>
        )}

        <button className="btn-ghost" style={{ width: '100%' }} onClick={onNew}>
          <i className="fa-solid fa-rotate-right" />
          {t('newBooking')}
        </button>
      </div>
    </div>
  );
}
