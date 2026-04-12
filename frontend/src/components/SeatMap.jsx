import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

export default function SeatMap({ apiUrl, flightId, onSeatSelect, flight }) {
  const API_URL = apiUrl || 'http://localhost:3001/api/v1';
  const { t } = useTranslation();
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError(null);
    axios.get(`${API_URL}/flights/${flightId}/seats`)
      .then(r => setSeats(r.data.seats))
      .catch(() => setError(t('loadingSeats')))
      .finally(() => setLoading(false));
  }, [flightId, API_URL]);

  if (loading) return (
    <div className="card" style={{ textAlign: 'center', padding: '56px 24px' }}>
      <i className="fa-solid fa-circle-notch fa-spin"
        style={{ fontSize: '1.6rem', color: '#3960FB', display: 'block', marginBottom: '14px' }} />
      <p style={{ color: '#6B7A99', fontSize: '0.88rem' }}>{t('loadingSeats')}</p>
    </div>
  );

  if (error) return (
    <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
      <i className="fa-solid fa-triangle-exclamation"
        style={{ fontSize: '1.5rem', color: '#EF4444', display: 'block', marginBottom: '10px' }} />
      <p style={{ fontWeight: 600, color: '#EF4444' }}>{error}</p>
    </div>
  );

  const firstSeats = seats.filter(s => s.class_type === 'FIRST');
  const econSeats  = seats.filter(s => s.class_type === 'ECONOMY');
  const available  = seats.filter(s => s.status === 'AVAILABLE').length;
  const sold       = seats.filter(s => s.status === 'SOLD').length;
  const reserved   = seats.filter(s => s.status === 'RESERVED').length;
  const occupancy  = seats.length > 0 ? Math.round((sold / seats.length) * 100) : 0;

  // Split economy into sections of ~30 seats (5 rows × 6)
  const ECON_SECTION = 30;
  const econSections = [];
  for (let i = 0; i < econSeats.length; i += ECON_SECTION)
    econSections.push(econSeats.slice(i, i + ECON_SECTION));

  const sections = [
    { id: 0, label: t('businessClass'), seats: firstSeats, isFirst: true },
    ...econSections.map((s, i) => ({
      id: i + 1, label: `${t('economyClass')} ${i + 1}`, seats: s, isFirst: false,
    })),
  ];

  const getSeatClass = (s) => {
    if (s.status === 'AVAILABLE') return s.class_type === 'FIRST' ? 'seat-btn seat-first-available' : 'seat-btn seat-available';
    if (s.status === 'RESERVED')  return 'seat-btn seat-reserved';
    if (s.status === 'SOLD')      return 'seat-btn seat-sold';
    if (s.status === 'REFUNDED')  return 'seat-btn seat-refunded';
    return 'seat-btn seat-available';
  };

  // Group seats into rows of 6 (A B C | D E F)
  const toRows = (arr) => {
    const rows = [];
    for (let i = 0; i < arr.length; i += 6) rows.push(arr.slice(i, i + 6));
    return rows;
  };

  const currentSection = sections[activeSection] || sections[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* ── Stats strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {[
          { label: t('seatsAvailable'), value: available,        icon: 'fa-circle-check',  color: '#3960FB', bg: '#EBEFFF' },
          { label: t('seatsReserved'),  value: reserved,         icon: 'fa-clock',          color: '#D97706', bg: '#FEF9C3' },
          { label: t('seatsSold'),      value: sold,             icon: 'fa-circle-xmark',   color: '#6B7A99', bg: '#F3F4F6' },
          { label: t('occupancy'),      value: occupancy + '%',  icon: 'fa-chart-simple',   color: '#0CAF60', bg: '#E6FBF1' },
        ].map(({ label, value, icon, color, bg }) => (
          <div key={label} style={{ background: bg, borderRadius: '14px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
              <i className={`fa-solid ${icon}`} style={{ color, fontSize: '0.88rem' }} />
            </div>
            <div>
              <p style={{ fontSize: '1.25rem', fontWeight: 800, color, lineHeight: 1, marginBottom: '1px' }}>{value}</p>
              <p style={{ fontSize: '0.65rem', fontWeight: 600, color, opacity: 0.75, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main seat card ── */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5FF' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#142258' }}>
              <i className="fa-solid fa-chair" style={{ color: '#3960FB', marginRight: '10px', fontSize: '1rem' }} />
              {t('chooseSeats')}
            </h2>
            <p style={{ fontSize: '0.78rem', color: '#6B7A99', fontStyle: 'italic' }}>
              <i className="fa-solid fa-circle-info" style={{ marginRight: '5px', color: '#C2CEFE' }} />
              {t('seatHint')}
            </p>
          </div>

          {/* Section tabs */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#B0BBD5', letterSpacing: '0.08em', textTransform: 'uppercase', marginRight: '4px' }}>
              {t('section')}
            </span>
            {sections.map((sec, i) => (
              <button
                key={sec.id}
                className={'section-tab' + (activeSection === i ? ' active' : '')}
                onClick={() => setActiveSection(i)}
                title={sec.label}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Airplane top-view SVG */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '18px 0 8px', background: '#F7F9FF', borderBottom: '1px solid #EBEFFF' }}>
          <svg width="260" height="56" viewBox="0 0 260 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Fuselage */}
            <rect x="50" y="20" width="160" height="16" rx="8" fill="#C2CEFE" />
            {/* Nose */}
            <ellipse cx="215" cy="28" rx="14" ry="8" fill="#AABCFE" />
            {/* Tail */}
            <path d="M50 28 L28 14 L28 42 Z" fill="#C2CEFE" />
            {/* Wings */}
            <path d="M140 28 L200 4 L200 10 L155 28 Z" fill="#EBEFFF" stroke="#C2CEFE" strokeWidth="1" />
            <path d="M140 28 L200 52 L200 46 L155 28 Z" fill="#EBEFFF" stroke="#C2CEFE" strokeWidth="1" />
            {/* Tail fins */}
            <path d="M65 28 L50 16 L50 22 Z" fill="#AABCFE" />
            <path d="M65 28 L50 40 L50 34 Z" fill="#AABCFE" />
            {/* Windows row */}
            {[0,1,2,3,4,5,6,7,8].map(i => (
              <ellipse key={i} cx={80 + i * 16} cy="28" rx="4" ry="3" fill="#ffffff" opacity="0.7" />
            ))}
            {/* Section highlight */}
            <rect
              x={currentSection.isFirst ? 156 : 66}
              y="21"
              width={currentSection.isFirst ? 46 : 86}
              height="14"
              rx="4"
              fill="#3960FB"
              opacity="0.18"
            />
          </svg>
        </div>

        {/* Section label */}
        <div style={{ background: '#F7F9FF', padding: '10px 24px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {currentSection.isFirst ? (
            <span className="tag tag-gold">
              <i className="fa-solid fa-star" style={{ fontSize: '0.6rem' }} />
              {t('businessClass')}
            </span>
          ) : (
            <span className="tag tag-blue">
              <i className="fa-solid fa-plane" style={{ fontSize: '0.6rem' }} />
              {t('economyClass')}
            </span>
          )}
          <span style={{ fontSize: '0.75rem', color: '#6B7A99' }}>
            {t('section')} {activeSection + 1} · {currentSection.seats.length} {t('seat').toLowerCase()}s
          </span>
        </div>

        {/* Seat grid */}
        <div style={{ padding: '20px 24px 24px' }}>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 8px 1fr', gap: '0', marginBottom: '8px' }}>
            <div />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
              {['A', 'B', 'C'].map(c => (
                <div key={c} style={{ textAlign: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#B0BBD5', letterSpacing: '0.05em' }}>{c}</div>
              ))}
            </div>
            <div />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
              {['D', 'E', 'F'].map(c => (
                <div key={c} style={{ textAlign: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#B0BBD5', letterSpacing: '0.05em' }}>{c}</div>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {toRows(currentSection.seats).map((row, ri) => {
              const left  = row.slice(0, 3);
              const right = row.slice(3, 6);
              const rowNum = row[0]?.seat_number?.replace(/[A-F]/, '') || (ri + 1);
              return (
                <div key={ri} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 8px 1fr', gap: '0', alignItems: 'center' }}>
                  {/* Row number */}
                  <div style={{ fontSize: '0.6rem', fontWeight: 700, color: '#C2CEFE', textAlign: 'center', paddingRight: '4px' }}>
                    {rowNum}
                  </div>
                  {/* Left seats A B C */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
                    {left.map(seat => (
                      <button
                        key={seat.seat_number}
                        disabled={seat.status !== 'AVAILABLE'}
                        onClick={() => seat.status === 'AVAILABLE' && onSeatSelect(seat)}
                        className={getSeatClass(seat)}
                        title={`${seat.seat_number} · ${seat.status}`}
                        style={{ width: '100%', aspectRatio: '1' }}
                      >
                        {seat.seat_number}
                      </button>
                    ))}
                  </div>
                  {/* Aisle */}
                  <div />
                  {/* Right seats D E F */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
                    {right.map(seat => (
                      <button
                        key={seat.seat_number}
                        disabled={seat.status !== 'AVAILABLE'}
                        onClick={() => seat.status === 'AVAILABLE' && onSeatSelect(seat)}
                        className={getSeatClass(seat)}
                        title={`${seat.seat_number} · ${seat.status}`}
                        style={{ width: '100%', aspectRatio: '1' }}
                      >
                        {seat.seat_number}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div style={{ borderTop: '1px solid #F1F5FF', padding: '14px 24px', display: 'flex', gap: '20px', flexWrap: 'wrap', background: '#FAFBFF' }}>
          {[
            { cls: 'seat-btn seat-first-available', label: t('businessClass') },
            { cls: 'seat-btn seat-available',       label: t('available') },
            { cls: 'seat-btn seat-reserved',        label: t('reserved') },
            { cls: 'seat-btn seat-sold',            label: t('sold') },
            { cls: 'seat-btn seat-refunded',        label: t('refunded') },
          ].map(({ cls, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className={cls} style={{ width: '20px', height: '16px', padding: 0, pointerEvents: 'none', fontSize: '0', flexShrink: 0 }} />
              <span style={{ fontSize: '0.72rem', color: '#6B7A99', fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
