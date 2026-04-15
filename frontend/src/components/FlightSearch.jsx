import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

export default function FlightSearch({ apiUrl, onFlightSelect }) {
  const API_URL = apiUrl || 'http://localhost:3001/api/v1';
  const { t } = useTranslation();
  const [airports, setAirports] = useState([]);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [originSugg, setOriginSugg] = useState([]);
  const [destSugg, setDestSugg] = useState([]);

  useEffect(() => {
    axios.get(API_URL + '/airports').then(r => setAirports(r.data.airports)).catch(() => {});
  }, [API_URL]);

  const filter = (val) => airports.filter(a => a.includes(val.toUpperCase())).slice(0, 5);

  const searchFlights = async () => {
    setLoading(true);
    setSearched(false);
    try {
      const params = {};
      if (origin)      params.origin = origin;
      if (destination) params.destination = destination;
      if (date)        params.date = date;
      const r = await axios.get(API_URL + '/flights', { params });
      setFlights(r.data);
      setSearched(true);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fmtDate = (d) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const fmtTime = (t) => (t || '').substring(0, 5);

  return (
    <div>
      {/* Heading */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#142258', marginBottom: '4px' }}>
          {t('searchTitle')}
        </h1>
        <p style={{ color: '#6B7A99', fontSize: '0.9rem' }}>{t('searchSubtitle')}</p>
      </div>

      {/* Search card */}
      <div className="card fade-up" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '14px', alignItems: 'end' }}>

          {/* Origin */}
          <div style={{ position: 'relative' }}>
            <label className="input-label">
              <i className="fa-solid fa-plane-departure" />
              {t('origin')}
            </label>
            <input
              type="text"
              value={origin}
              onChange={e => { setOrigin(e.target.value); setOriginSugg(e.target.value ? filter(e.target.value) : []); }}
              onBlur={() => setTimeout(() => setOriginSugg([]), 160)}
              placeholder={t('originPlaceholder')}
              className="input-field"
              style={{ textTransform: 'uppercase' }}
            />
            {originSugg.length > 0 && (
              <div className="dropdown">
                {originSugg.map(s => (
                  <div key={s} className="dropdown-item" onMouseDown={() => { setOrigin(s); setOriginSugg([]); }}>{s}</div>
                ))}
              </div>
            )}
          </div>

          {/* Destination */}
          <div style={{ position: 'relative' }}>
            <label className="input-label">
              <i className="fa-solid fa-plane-arrival" />
              {t('destination')}
            </label>
            <input
              type="text"
              value={destination}
              onChange={e => { setDestination(e.target.value); setDestSugg(e.target.value ? filter(e.target.value) : []); }}
              onBlur={() => setTimeout(() => setDestSugg([]), 160)}
              placeholder={t('destPlaceholder')}
              className="input-field"
              style={{ textTransform: 'uppercase' }}
            />
            {destSugg.length > 0 && (
              <div className="dropdown">
                {destSugg.map(s => (
                  <div key={s} className="dropdown-item" onMouseDown={() => { setDestination(s); setDestSugg([]); }}>{s}</div>
                ))}
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="input-label">
              <i className="fa-solid fa-calendar-days" />
              {t('date')}
            </label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="input-field"
              style={{ colorScheme: 'light' }}
            />
          </div>

          {/* Search button */}
          <button
            onClick={searchFlights}
            disabled={loading}
            className="btn-primary"
            style={{ height: '48px', paddingLeft: '24px', paddingRight: '24px', whiteSpace: 'nowrap' }}
          >
            {loading
              ? <i className="fa-solid fa-circle-notch fa-spin" />
              : <><i className="fa-solid fa-magnifying-glass" />{t('search')}</>
            }
          </button>
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div>
          {/* Count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <p style={{ fontWeight: 700, color: '#142258', fontSize: '0.95rem', flexShrink: 0 }}>
              {flights.length > 0
                ? `${flights.length} ${flights.length === 1 ? t('flightsFound') : t('flightsFoundPlural')}`
                : t('noFlights')
              }
            </p>
            <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
          </div>

          {flights.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {flights.map((fl, i) => (
                <FlightCard
                  key={fl.id}
                  flight={fl}
                  onSelect={onFlightSelect}
                  fmtDate={fmtDate}
                  fmtTime={fmtTime}
                  delay={i * 0.06}
                  t={t}
                />
              ))}
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <i className="fa-solid fa-globe" style={{ fontSize: '2rem', color: '#C2CEFE', marginBottom: '12px', display: 'block' }} />
              <p style={{ fontWeight: 700, color: '#142258', marginBottom: '6px' }}>{t('noFlights')}</p>
              <p style={{ color: '#6B7A99', fontSize: '0.85rem' }}>{t('noFlightsDesc')}</p>
            </div>
          )}
        </div>
      )}

      {!searched && !loading && (
        <p style={{ textAlign: 'center', color: '#B0BBD5', fontSize: '0.8rem', marginTop: '8px' }}>
          <i className="fa-solid fa-circle-info" style={{ marginRight: '5px' }} />
          {t('searchHint')}
        </p>
      )}
    </div>
  );
}

function FlightCard({ flight, onSelect, fmtDate, fmtTime, delay, t }) {
  return (
    <div
      className="card card-hover fade-up"
      style={{ padding: '20px 24px', animationDelay: `${delay}s` }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
        {/* Route */}
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '0.68rem', fontWeight: 700, color: '#B0BBD5', letterSpacing: '0.08em', marginBottom: '10px' }}>
            {flight.flight_number}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <div style={{ textAlign: 'center', minWidth: '52px' }}>
              <span style={{ fontSize: '1.65rem', fontWeight: 800, color: '#142258', lineHeight: 1, display: 'block' }}>
                {flight.origin_code}
              </span>
              <span style={{ fontSize: '0.62rem', color: '#6B7A99', letterSpacing: '0.04em' }}>{t('departure')}</span>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6B7A99' }}>{fmtTime(flight.departure_time)}</span>
              <div className="route-line">
                <div className="route-dot" />
                <div className="route-dashes" />
                <i className="fa-solid fa-plane" style={{ color: '#3960FB', fontSize: '0.82rem', flexShrink: 0 }} />
                <div className="route-dashes" />
                <div className="route-dot" />
              </div>
            </div>

            <div style={{ textAlign: 'center', minWidth: '52px' }}>
              <span style={{ fontSize: '1.65rem', fontWeight: 800, color: '#142258', lineHeight: 1, display: 'block' }}>
                {flight.destination_code}
              </span>
              <span style={{ fontSize: '0.62rem', color: '#6B7A99', letterSpacing: '0.04em' }}>{t('destination')}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: '#6B7A99' }}>
              <i className="fa-regular fa-calendar" style={{ marginRight: '4px', fontSize: '0.7rem' }} />
              {fmtDate(flight.departure_date)}
            </span>
            <span style={{ color: '#C2CEFE' }}>·</span>
            <span style={{ fontSize: '0.75rem', color: '#6B7A99' }}>
              <i className="fa-solid fa-door-open" style={{ marginRight: '4px', fontSize: '0.7rem' }} />
              {t('gate')} {flight.gate}
            </span>
            <span className="tag tag-green" style={{ fontSize: '0.65rem', padding: '3px 9px' }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: '0.6rem' }} />
              {t('scheduled')}
            </span>
          </div>
        </div>

        {/* Separator */}
        <div style={{ width: '1px', height: '70px', background: '#F1F5FF', margin: '0 22px', flexShrink: 0 }} />

        {/* Price + CTA */}
        <div style={{ textAlign: 'right', minWidth: '138px', flexShrink: 0 }}>
          <p style={{ fontSize: '0.62rem', fontWeight: 700, color: '#B0BBD5', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>
            {t('from')}
          </p>
          <p style={{ fontSize: '1.75rem', fontWeight: 800, color: '#3960FB', lineHeight: 1, marginBottom: '2px' }}>
            ${parseFloat(flight.economy_price).toLocaleString()}
          </p>
          <p style={{ fontSize: '0.7rem', color: '#B0BBD5', marginBottom: '12px' }}>
            {t('firstClass')}: ${parseFloat(flight.first_class_price).toLocaleString()}
          </p>
          <button
            className="btn-primary"
            style={{ fontSize: '0.75rem', padding: '9px 20px' }}
            onClick={() => onSelect(flight)}
          >
            {t('select')}
          </button>
        </div>
      </div>
    </div>
  );
}
