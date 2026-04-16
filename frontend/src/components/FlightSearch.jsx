import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

export default function FlightSearch({ apiUrl, onFlightSelect }) {
  const API_URL = apiUrl || 'http://localhost:3001/api/v1';
  const { t } = useTranslation();

  const [airports, setAirports] = useState([]);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [dateRange, setDateRange] = useState({ min: '', max: '' });
  const [searchError, setSearchError] = useState('');

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

  const originRef = useRef(null);
  const destRef = useRef(null);

  useEffect(() => {
    axios.get(API_URL + '/airports')
      .then(r => {
        const airportList = (r.data.airports || []).map(code => ({
          code,
          name: getAirportName(code),
          city: getCityName(code),
          country: getCountryName(code),
        }));
        setAirports(airportList);
      })
      .catch(() => {
        setAirports([]);
      });
  }, [API_URL]);

  useEffect(() => {
    if (origin && destination) {
      fetchAvailableDates();
    }
  }, [origin, destination]);

  useEffect(() => {
    const term = originSearchTerm.toLowerCase().trim();

    const filtered = airports.filter(a =>
      (!destination || a.code !== destination.code) &&
      (
        term === '' ||
        a.code.toLowerCase().includes(term) ||
        a.city.toLowerCase().includes(term) ||
        a.country.toLowerCase().includes(term) ||
        a.name.toLowerCase().includes(term)
      )
    ).slice(0, 8);

    setOriginFiltered(filtered);
  }, [originSearchTerm, airports, destination]);

  useEffect(() => {
    const term = destSearchTerm.toLowerCase().trim();

    const filtered = airports.filter(a =>
      (!origin || a.code !== origin.code) &&
      (
        term === '' ||
        a.code.toLowerCase().includes(term) ||
        a.city.toLowerCase().includes(term) ||
        a.country.toLowerCase().includes(term) ||
        a.name.toLowerCase().includes(term)
      )
    ).slice(0, 8);

    setDestFiltered(filtered);
  }, [destSearchTerm, airports, origin]);

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

  const getAirportName = (code) => {
    const names = {
      ATL: 'Hartsfield-Jackson Atlanta Intl',
      PEK: 'Beijing Capital Intl',
      DXB: 'Dubai International',
      TYO: 'Tokyo Haneda Intl',
      LON: 'London Heathrow',
      LAX: 'Los Angeles Intl',
      PAR: 'Charles de Gaulle',
      FRA: 'Frankfurt Airport',
      IST: 'Istanbul Airport',
      SIN: 'Singapore Changi',
      MAD: 'Madrid-Barajas',
      AMS: 'Amsterdam Schiphol',
      DFW: 'Dallas/Fort Worth',
      CAN: 'Guangzhou Baiyun',
      SAO: 'São Paulo Guarulhos'
    };
    return names[code] || `${code} Airport`;
  };

  const getCityName = (code) => {
    const cities = {
      ATL: 'Atlanta', PEK: 'Beijing', DXB: 'Dubai', TYO: 'Tokyo',
      LON: 'London', LAX: 'Los Angeles', PAR: 'Paris', FRA: 'Frankfurt',
      IST: 'Istanbul', SIN: 'Singapore', MAD: 'Madrid', AMS: 'Amsterdam',
      DFW: 'Dallas', CAN: 'Guangzhou', SAO: 'São Paulo'
    };
    return cities[code] || code;
  };

  const getCountryName = (code) => {
    const countries = {
      ATL: 'USA', PEK: 'China', DXB: 'UAE', TYO: 'Japan',
      LON: 'UK', LAX: 'USA', PAR: 'France', FRA: 'Germany',
      IST: 'Turkey', SIN: 'Singapore', MAD: 'Spain', AMS: 'Netherlands',
      DFW: 'USA', CAN: 'China', SAO: 'Brazil'
    };
    return countries[code] || '';
  };

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

  const searchFlights = async (page = 1) => {
    setLoading(true);
    setSearchError('');

    try {
      const params = {};
      if (origin) params.origin = origin.code;
      if (destination) params.destination = destination.code;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      params.page = page;
      params.limit = 20;

      const response = await axios.get(`${API_URL}/flights`, { params });

      if (response.data.success) {
        setFlights(response.data.data);
        setCurrentPage(response.data.pagination.page);
        setTotalPages(response.data.pagination.pages);
        setTotalResults(response.data.pagination.total);
        setHasNext(response.data.pagination.hasNext);
        setHasPrev(response.data.pagination.hasPrev);
      } else {
        setFlights([]);
        setTotalResults(0);
      }

      setSearched(true);
    } catch (error) {
      console.error('Error searching flights:', error);
      setFlights([]);
      setTotalResults(0);
      setSearched(true);
      setSearchError(error.response?.data?.error || 'No se pudo realizar la búsqueda');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setSearchError('');

    if (!origin || !destination) {
      setSearchError('Selecciona origen y destino');
      return;
    }

    if (origin.code === destination.code) {
      setSearchError('El origen y el destino no pueden ser iguales');
      return;
    }

    if (startDate && endDate && endDate < startDate) {
      setSearchError('La fecha de vuelta no puede ser menor que la fecha de ida');
      return;
    }

    setCurrentPage(1);
    searchFlights(1);
  };

  const goToPage = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      searchFlights(newPage);
    }
  };

  const swapLocations = () => {
    if (origin && destination) {
      const tempOrigin = origin;
      setOrigin(destination);
      setDestination(tempOrigin);
      setOriginSearchTerm(destination.city);
      setDestSearchTerm(tempOrigin.city);
    }
  };

  const selectOrigin = (airport) => {
    setOrigin(airport);
    setOriginSearchTerm(airport.city);
    setOriginDropdownOpen(false);
    setSearchError('');
  };

  const selectDestination = (airport) => {
    setDestination(airport);
    setDestSearchTerm(airport.city);
    setDestDropdownOpen(false);
    setSearchError('');
  };

  const clearOrigin = () => {
    setOrigin(null);
    setOriginSearchTerm('');
  };

  const clearDestination = () => {
    setDestination(null);
    setDestSearchTerm('');
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    return timeStr.substring(0, 5);
  };

  return (
    <div>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#142258', marginBottom: '6px' }}>
          {t('searchTitle')}
        </h1>
        <p style={{ color: '#6B7A99', fontSize: '0.9rem' }}>{t('searchSubtitle')}</p>
      </div>

      <div className="card fade-up" style={{ padding: '28px', marginBottom: '28px', background: '#ffffff', borderRadius: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', marginBottom: '24px' }}>
          
          {/* ORIGIN */}
          <div ref={originRef} style={{ position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#142258', fontSize: '0.75rem' }}>
              <i className="fa-solid fa-plane-departure" style={{ marginRight: '6px' }} />
              {t('origin')}
            </label>

            <div style={{
              border: originDropdownOpen ? '2px solid #3960FB' : '1px solid #E2E8F0',
              borderRadius: '16px',
              background: '#ffffff',
              padding: '10px 12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-location-dot" style={{ color: '#3960FB' }} />
                <input
                  type="text"
                  value={origin ? `${origin.city} (${origin.code})` : originSearchTerm}
                  onFocus={() => setOriginDropdownOpen(true)}
                  onChange={(e) => {
                    if (origin) setOrigin(null);
                    setOriginSearchTerm(e.target.value);
                    setOriginDropdownOpen(true);
                  }}
                  placeholder="Buscar ciudad, país o aeropuerto..."
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    fontSize: '0.92rem',
                    color: '#142258',
                    background: 'transparent'
                  }}
                />
                {origin && (
                  <button
                    type="button"
                    onClick={clearOrigin}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#B0BBD5' }}
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                )}
              </div>
            </div>

            {originDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                marginTop: '8px',
                zIndex: 1000,
                maxHeight: '320px',
                overflowY: 'auto',
                border: '1px solid #F1F5FF'
              }}>
                {originFiltered.length > 0 ? originFiltered.map(airport => (
                  <div
                    key={airport.code}
                    onClick={() => selectOrigin(airport)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #F8FAFC'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <i className="fa-solid fa-plane" style={{ color: '#3960FB' }} />
                      <div>
                        <div style={{ fontWeight: 700, color: '#142258' }}>{airport.city}</div>
                        <div style={{ fontSize: '0.7rem', color: '#6B7A99' }}>{airport.country} · {airport.name}</div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: '#3960FB' }}>{airport.code}</div>
                  </div>
                )) : (
                  <div style={{ padding: '16px', color: '#6B7A99', fontSize: '0.85rem' }}>
                    No se encontraron coincidencias
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SWAP */}
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
            <button
              onClick={swapLocations}
              type="button"
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: '#F1F5FF',
                border: 'none',
                cursor: 'pointer',
                color: '#3960FB'
              }}
            >
              <i className="fa-solid fa-arrow-right-arrow-left" />
            </button>
          </div>

          {/* DESTINATION */}
          <div ref={destRef} style={{ position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#142258', fontSize: '0.75rem' }}>
              <i className="fa-solid fa-plane-arrival" style={{ marginRight: '6px' }} />
              {t('destination')}
            </label>

            <div style={{
              border: destDropdownOpen ? '2px solid #3960FB' : '1px solid #E2E8F0',
              borderRadius: '16px',
              background: '#ffffff',
              padding: '10px 12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-location-dot" style={{ color: '#3960FB' }} />
                <input
                  type="text"
                  value={destination ? `${destination.city} (${destination.code})` : destSearchTerm}
                  onFocus={() => setDestDropdownOpen(true)}
                  onChange={(e) => {
                    if (destination) setDestination(null);
                    setDestSearchTerm(e.target.value);
                    setDestDropdownOpen(true);
                  }}
                  placeholder="Buscar ciudad, país o aeropuerto..."
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    fontSize: '0.92rem',
                    color: '#142258',
                    background: 'transparent'
                  }}
                />
                {destination && (
                  <button
                    type="button"
                    onClick={clearDestination}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#B0BBD5' }}
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                )}
              </div>
            </div>

            {destDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                marginTop: '8px',
                zIndex: 1000,
                maxHeight: '320px',
                overflowY: 'auto',
                border: '1px solid #F1F5FF'
              }}>
                {destFiltered.length > 0 ? destFiltered.map(airport => (
                  <div
                    key={airport.code}
                    onClick={() => selectDestination(airport)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #F8FAFC'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#F8FAFC'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <i className="fa-solid fa-plane" style={{ color: '#3960FB' }} />
                      <div>
                        <div style={{ fontWeight: 700, color: '#142258' }}>{airport.city}</div>
                        <div style={{ fontSize: '0.7rem', color: '#6B7A99' }}>{airport.country} · {airport.name}</div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: '#3960FB' }}>{airport.code}</div>
                  </div>
                )) : (
                  <div style={{ padding: '16px', color: '#6B7A99', fontSize: '0.85rem' }}>
                    No se encontraron coincidencias
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* FECHAS */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#142258', fontSize: '0.75rem' }}>
              <i className="fa-solid fa-calendar" style={{ marginRight: '6px' }} />
              Fecha de Ida
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '1px solid #E2E8F0',
                borderRadius: '16px',
                fontSize: '0.9rem',
                background: '#ffffff'
              }}
              min={dateRange.min || '2026-03-01'}
              max={dateRange.max || '2026-04-30'}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#142258', fontSize: '0.75rem' }}>
              <i className="fa-solid fa-calendar" style={{ marginRight: '6px' }} />
              Fecha de Vuelta (opcional)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '1px solid #E2E8F0',
                borderRadius: '16px',
                fontSize: '0.9rem',
                background: '#ffffff'
              }}
              min={startDate || dateRange.min || '2026-03-01'}
              max={dateRange.max || '2026-04-30'}
            />
          </div>
        </div>

        {origin && destination && dateRange.min && dateRange.max && (
          <div style={{ marginBottom: '16px', fontSize: '0.75rem', color: '#6B7A99', textAlign: 'center' }}>
            📅 Vuelos disponibles entre {formatDate(dateRange.min)} y {formatDate(dateRange.max)}
          </div>
        )}

        {searchError && (
          <div style={{
            marginBottom: '16px',
            background: '#FEF2F2',
            color: '#B91C1C',
            border: '1px solid #FECACA',
            borderRadius: '12px',
            padding: '12px 14px',
            fontSize: '0.85rem',
            fontWeight: 600
          }}>
            <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '8px' }} />
            {searchError}
          </div>
        )}

        <button
          onClick={handleSearch}
          disabled={loading}
          style={{
            width: '100%',
            padding: '16px',
            fontSize: '1rem',
            fontWeight: 700,
            borderRadius: '40px',
            background: 'linear-gradient(135deg, #3960FB 0%, #1A2EB5 100%)',
            border: 'none',
            color: '#ffffff',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading
            ? <><i className="fa-solid fa-circle-notch fa-spin" /> Buscando...</>
            : <><i className="fa-solid fa-magnifying-glass" /> {t('search')}</>
          }
        </button>
      </div>

      {searched && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
            <p style={{ fontWeight: 700, color: '#142258' }}>
              {totalResults > 0 ? `${totalResults.toLocaleString()} vuelos encontrados` : 'No se encontraron vuelos'}
            </p>

            {totalPages > 0 && (
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={!hasPrev}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '30px',
                    border: '1px solid #E2E8F0',
                    background: hasPrev ? '#fff' : '#F8FAFC',
                    cursor: hasPrev ? 'pointer' : 'not-allowed'
                  }}
                >
                  ← Anterior
                </button>
                <span>Página {currentPage} de {totalPages}</span>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={!hasNext}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '30px',
                    border: '1px solid #E2E8F0',
                    background: hasNext ? '#fff' : '#F8FAFC',
                    cursor: hasNext ? 'pointer' : 'not-allowed'
                  }}
                >
                  Siguiente →
                </button>
              </div>
            )}
          </div>

          {flights.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {flights.map(flight => (
                <div
                  key={flight.id}
                  style={{
                    padding: '20px',
                    background: '#fff',
                    borderRadius: '20px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ marginBottom: '8px' }}>
                        <span style={{ fontWeight: 700 }}>{flight.flight_number}</span>
                        <span style={{ marginLeft: '12px', fontSize: '0.7rem', background: '#E6FBF1', padding: '2px 8px', borderRadius: '20px', color: '#0CAF60' }}>
                          {flight.status}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{flight.origin_code}</span>
                          <div style={{ fontSize: '0.7rem', color: '#6B7A99' }}>{formatTime(flight.departure_time)}</div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <i className="fa-solid fa-plane" style={{ color: '#3960FB' }} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{flight.destination_code}</span>
                          <div style={{ fontSize: '0.7rem', color: '#6B7A99' }}>{formatTime(flight.arrival_time || '--:--')}</div>
                        </div>
                      </div>
                      <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#6B7A99' }}>
                        {formatDate(flight.departure_date)} · Puerta {flight.gate || 'TBD'}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.6rem', color: '#B0BBD5' }}>Desde</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3960FB' }}>
                        ${flight.economy_price || 250}
                      </div>
                      <button
                        onClick={() => onFlightSelect(flight)}
                        style={{
                          marginTop: '8px',
                          padding: '8px 20px',
                          background: '#3960FB',
                          border: 'none',
                          borderRadius: '30px',
                          color: '#fff',
                          cursor: 'pointer'
                        }}
                      >
                        Seleccionar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px', background: '#fff', borderRadius: '24px' }}>
              <p>No se encontraron vuelos para los filtros seleccionados.</p>
              <p style={{ fontSize: '0.8rem', color: '#6B7A99' }}>
                Prueba con otras fechas entre {dateRange.min || 'marzo'} y {dateRange.max || 'abril'} 2026
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
