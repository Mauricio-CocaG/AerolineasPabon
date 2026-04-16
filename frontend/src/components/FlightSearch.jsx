import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

export default function FlightSearch({ apiUrl, onFlightSelect }) {
  const API_URL = apiUrl || 'http://localhost:3001/api/v1';
  const { t } = useTranslation();

  // Estados de búsqueda
  const [originAirports, setOriginAirports] = useState([]);
  const [destinationAirports, setDestinationAirports] = useState([]);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [dateRange, setDateRange] = useState({ min: '', max: '' });

  // Dropdown states
  const [originDropdownOpen, setOriginDropdownOpen] = useState(false);
  const [destDropdownOpen, setDestDropdownOpen] = useState(false);
  const [originSearchTerm, setOriginSearchTerm] = useState('');
  const [destSearchTerm, setDestSearchTerm] = useState('');
  const [originFiltered, setOriginFiltered] = useState([]);
  const [destFiltered, setDestFiltered] = useState([]);

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  // Refs
  const originRef = useRef(null);
  const destRef = useRef(null);

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
      ATL: 'Atlanta',
      PEK: 'Beijing',
      DXB: 'Dubai',
      TYO: 'Tokyo',
      LON: 'London',
      LAX: 'Los Angeles',
      PAR: 'Paris',
      FRA: 'Frankfurt',
      IST: 'Istanbul',
      SIN: 'Singapore',
      MAD: 'Madrid',
      AMS: 'Amsterdam',
      DFW: 'Dallas',
      CAN: 'Guangzhou',
      SAO: 'São Paulo'
    };
    return cities[code] || code;
  };

  const getCountryName = (code) => {
    const countries = {
      ATL: 'USA',
      PEK: 'CHINA',
      DXB: 'UAE',
      TYO: 'JAPAN',
      LON: 'UK',
      LAX: 'USA',
      PAR: 'FRANCE',
      FRA: 'GERMANY',
      IST: 'TURKEY',
      SIN: 'SINGAPORE',
      MAD: 'SPAIN',
      AMS: 'NETHERLANDS',
      DFW: 'USA',
      CAN: 'CHINA',
      SAO: 'BRAZIL'
    };
    return countries[code] || '';
  };

  const mapAirportCodes = (codes = []) =>
    codes.map((code) => ({
      code,
      name: getAirportName(code),
      city: getCityName(code),
      country: getCountryName(code)
    }));

  // Cargar orígenes reales
  useEffect(() => {
    const fetchOrigins = async () => {
      try {
        const response = await axios.get(`${API_URL}/flights/valid-origins`);
        if (response.data.success) {
          const airportList = mapAirportCodes(response.data.origins || []);
          setOriginAirports(airportList);
        }
      } catch (error) {
        console.error('Error fetching valid origins:', error);
      }
    };

    fetchOrigins();
  }, [API_URL]);

  // Cargar destinos válidos según origen
  useEffect(() => {
    const fetchDestinations = async () => {
      if (!origin) {
        setDestinationAirports([]);
        setDestination(null);
        setDestSearchTerm('');
        return;
      }

      try {
        const response = await axios.get(`${API_URL}/flights/destinations`, {
          params: { origin: origin.code }
        });

        if (response.data.success) {
          const airportList = mapAirportCodes(response.data.destinations || []);
          setDestinationAirports(airportList);

          if (destination && !airportList.some((a) => a.code === destination.code)) {
            setDestination(null);
            setDestSearchTerm('');
            setStartDate('');
            setEndDate('');
            setDateRange({ min: '', max: '' });
          }
        }
      } catch (error) {
        console.error('Error fetching valid destinations:', error);
        setDestinationAirports([]);
      }
    };

    fetchDestinations();
  }, [API_URL, origin]);

  // Cargar rango de fechas cuando origen y destino cambian
  useEffect(() => {
    if (origin && destination) {
      fetchAvailableDates();
    } else {
      setDateRange({ min: '', max: '' });
      setStartDate('');
      setEndDate('');
    }
  }, [origin, destination]);

  // Filtrar orígenes
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

  // Filtrar destinos reales del origen seleccionado
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

  // Cerrar dropdowns al hacer clic fuera
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

  const searchFlights = async (page = 1) => {
    if (!origin && !destination && !startDate && !endDate) {
      setFlights([]);
      setSearched(true);
      setTotalResults(0);
      return;
    }

    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    searchFlights(1);
  };

  const goToPage = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      searchFlights(newPage);
    }
  };

  const swapLocations = async () => {
    if (!origin && !destination) return;

    const oldOrigin = origin;
    const oldDestination = destination;

    setOrigin(oldDestination || null);
    setDestination(oldOrigin || null);

    setOriginSearchTerm(oldDestination ? oldDestination.city : '');
    setDestSearchTerm(oldOrigin ? oldOrigin.city : '');

    setStartDate('');
    setEndDate('');
    setDateRange({ min: '', max: '' });
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
  };

  const selectDestination = (airport) => {
    setDestination(airport);
    setDestSearchTerm(airport.city);
    setDestDropdownOpen(false);

    setStartDate('');
    setEndDate('');
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
          <div ref={originRef} style={{ position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#142258', fontSize: '0.75rem' }}>
              <i className="fa-solid fa-plane-departure" style={{ marginRight: '6px' }} />
              {t('origin')}
            </label>
            <div
              onClick={() => setOriginDropdownOpen(!originDropdownOpen)}
              style={{
                border: originDropdownOpen ? '2px solid #3960FB' : '1px solid #E2E8F0',
                borderRadius: '16px',
                padding: '14px 16px',
                cursor: 'pointer',
                background: '#ffffff'
              }}
            >
              {origin ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#142258' }}>{origin.city}</div>
                    <div style={{ fontSize: '0.7rem', color: '#6B7A99' }}>{origin.country}</div>
                  </div>
                  <span style={{ background: '#F1F5FF', padding: '2px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, color: '#3960FB' }}>
                    {origin.code}
                  </span>
                </div>
              ) : (
                <span style={{ color: '#B0BBD5' }}>{t('originPlaceholder')}</span>
              )}
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
                <div style={{ padding: '12px', borderBottom: '1px solid #F1F5FF' }}>
                  <input
                    type="text"
                    placeholder="Buscar ciudad o aeropuerto..."
                    value={originSearchTerm}
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
  }
}}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                    autoFocus
                  />
                </div>
                {originFiltered.map((airport) => (
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
                        <div style={{ fontSize: '0.7rem', color: '#6B7A99' }}>{airport.country}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#3960FB' }}>{airport.code}</div>
                      <div style={{ fontSize: '0.65rem', color: '#B0BBD5' }}>{airport.name.substring(0, 20)}...</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '4px' }}>
            <button
              onClick={swapLocations}
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

          <div ref={destRef} style={{ position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#142258', fontSize: '0.75rem' }}>
              <i className="fa-solid fa-plane-arrival" style={{ marginRight: '6px' }} />
              {t('destination')}
            </label>
            <div
              onClick={() => setDestDropdownOpen(!destDropdownOpen)}
              style={{
                border: destDropdownOpen ? '2px solid #3960FB' : '1px solid #E2E8F0',
                borderRadius: '16px',
                padding: '14px 16px',
                cursor: origin ? 'pointer' : 'not-allowed',
                background: origin ? '#ffffff' : '#F8FAFC',
                opacity: origin ? 1 : 0.7
              }}
            >
              {destination ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#142258' }}>{destination.city}</div>
                    <div style={{ fontSize: '0.7rem', color: '#6B7A99' }}>{destination.country}</div>
                  </div>
                  <span style={{ background: '#F1F5FF', padding: '2px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700, color: '#3960FB' }}>
                    {destination.code}
                  </span>
                </div>
              ) : (
                <span style={{ color: '#B0BBD5' }}>
                  {origin ? t('destPlaceholder') : 'Primero selecciona un origen'}
                </span>
              )}
            </div>

            {destDropdownOpen && origin && (
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
                <div style={{ padding: '12px', borderBottom: '1px solid #F1F5FF' }}>
                  <input
                    type="text"
                    placeholder="Buscar ciudad o aeropuerto..."
                    value={destSearchTerm}
                    onChange={(e) => {
  const value = e.target.value;
  setDestSearchTerm(value);

  if (value.trim() === '') {
    setDestination(null);
    setStartDate('');
    setEndDate('');
  }
}}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #E2E8F0',
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                    autoFocus
                  />
                </div>
                {destFiltered.map((airport) => (
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
                        <div style={{ fontSize: '0.7rem', color: '#6B7A99' }}>{airport.country}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#3960FB' }}>{airport.code}</div>
                      <div style={{ fontSize: '0.65rem', color: '#B0BBD5' }}>{airport.name.substring(0, 20)}...</div>
                    </div>
                  </div>
                ))}
                {destFiltered.length === 0 && (
                  <div style={{ padding: '16px', color: '#6B7A99', textAlign: 'center' }}>
                    No hay destinos disponibles para ese origen
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
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
          <div style={{ marginBottom: '16px', fontSize: '0.7rem', color: '#6B7A99', textAlign: 'center' }}>
            📅 Vuelos disponibles entre {formatDate(dateRange.min)} y {formatDate(dateRange.max)}
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
          {loading ? (
            <>
              <i className="fa-solid fa-circle-notch fa-spin" /> Buscando...
            </>
          ) : (
            <>
              <i className="fa-solid fa-magnifying-glass" /> {t('search')}
            </>
          )}
        </button>
      </div>

      {searched && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
            <p style={{ fontWeight: 700, color: '#142258' }}>
              {totalResults > 0 ? `${totalResults.toLocaleString()} vuelos encontrados` : 'No se encontraron vuelos'}
            </p>
            {totalPages > 0 && (
              <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => goToPage(currentPage - 1)} disabled={!hasPrev} style={{ padding: '6px 14px', borderRadius: '30px', border: '1px solid #E2E8F0', background: hasPrev ? '#fff' : '#F8FAFC', cursor: hasPrev ? 'pointer' : 'not-allowed' }}>← Anterior</button>
                <span>Página {currentPage} de {totalPages}</span>
                <button onClick={() => goToPage(currentPage + 1)} disabled={!hasNext} style={{ padding: '6px 14px', borderRadius: '30px', border: '1px solid #E2E8F0', background: hasNext ? '#fff' : '#F8FAFC', cursor: hasNext ? 'pointer' : 'not-allowed' }}>Siguiente →</button>
              </div>
            )}
          </div>

          {flights.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {flights.map((flight) => (
                <div key={flight.id} style={{ padding: '20px', background: '#fff', borderRadius: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ marginBottom: '8px' }}>
                        <span style={{ fontWeight: 700 }}>{flight.flight_number}</span>
                        <span style={{ marginLeft: '12px', fontSize: '0.7rem', background: '#E6FBF1', padding: '2px 8px', borderRadius: '20px', color: '#0CAF60' }}>{flight.status}</span>
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
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3960FB' }}>${flight.economy_price || 250}</div>
                      <button onClick={() => onFlightSelect(flight)} style={{ marginTop: '8px', padding: '8px 20px', background: '#3960FB', border: 'none', borderRadius: '30px', color: '#fff', cursor: 'pointer' }}>Seleccionar</button>
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