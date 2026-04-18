import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import ItineraryBooking from './ItineraryBooking';

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

  const originRef = useRef(null);
  const destRef = useRef(null);

  const mapAirportCodes = (codes = []) =>
    codes.map((code) => ({
      code,
      name: code,
      city: code,
      country: ''
    }));

  const mapReachableDestinations = (items = []) =>
    items.map((item) => ({
      code: item.code,
      name: item.code,
      city: item.code,
      country: '',
      totalCost: item.totalCost,
      totalTime: item.totalTime,
      stops: item.stops,
      route: item.route || []
    }));

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
          const airportList = mapReachableDestinations(response.data.destinations || []);
          setDestinationAirports(airportList);

          if (destination && !airportList.some((a) => a.code === destination.code)) {
            setDestination(null);
            setDestSearchTerm('');
            setStartDate('');
            setEndDate('');
            setDateRange({ min: '', max: '' });
            setRouteOptions(null);
            setDirectFlights([]);
            setSelectedItinerary(null);
            setSelectedItineraryLabel('');
          }
        }
      } catch (error) {
        console.error('Error fetching reachable destinations:', error);
        setDestinationAirports([]);
      }
    };

    fetchDestinations();
  }, [API_URL, origin]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (origin && destination) {
      fetchAvailableDates();
    } else {
      setDateRange({ min: '', max: '' });
      setStartDate('');
      setEndDate('');
    }
  }, [origin, destination]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const filtered = originAirports
      .filter(
        (a) =>
          (!destination || a.code !== destination.code) &&
          a.code.toLowerCase().includes(originSearchTerm.toLowerCase())
      )
      .slice(0, 8);

    setOriginFiltered(filtered);
  }, [originSearchTerm, originAirports, destination]);

  useEffect(() => {
    const filtered = destinationAirports
      .filter(
        (a) =>
          (!origin || a.code !== origin.code) &&
          a.code.toLowerCase().includes(destSearchTerm.toLowerCase())
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
    setOriginSearchTerm(airport.code);
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
    setDestSearchTerm(airport.code);
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
      <div
        style={{
          padding: '18px',
          background: '#fff',
          borderRadius: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          marginBottom: '14px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: '#142258', marginBottom: '8px' }}>{title}</div>
            <div style={{ fontSize: '0.9rem', color: '#3960FB', fontWeight: 700, marginBottom: '10px' }}>
              {routeObj.origin} → {routeObj.destination}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  background: '#F1F5FF',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  color: '#1A2EB5',
                  fontWeight: 700
                }}
              >
                {routeObj.stops === 0 ? 'Directo' : `${routeObj.stops} escala(s)`}
              </span>
              <span
                style={{
                  fontSize: '0.75rem',
                  background: '#F8FAFC',
                  padding: '4px 10px',
                  borderRadius: '999px',
                  color: '#6B7A99',
                  fontWeight: 700
                }}
              >
                Tiempo total: {formatDuration(routeObj.totalTime)}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {routeObj.route.map((segment, index) => (
                <div
                  key={`${segment.from}-${segment.to}-${index}`}
                  style={{
                    padding: '10px 12px',
                    background: '#F8FAFC',
                    borderRadius: '14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#142258' }}>
                    {segment.from} → {segment.to}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#6B7A99' }}>
                    {formatMoney(segment.cost)} · {formatDuration(segment.time)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ minWidth: '180px', textAlign: 'right' }}>
            <div style={{ fontSize: '0.65rem', color: '#B0BBD5', textTransform: 'uppercase', fontWeight: 700 }}>
              Precio total
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3960FB' }}>
              {formatMoney(routeObj.totalCost)}
            </div>

            {routeObj.route.length > 1 ? (
              <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#A66B00', fontWeight: 700 }}>
                Ruta con escalas
              </div>
            ) : (
              <div style={{ marginTop: '10px', fontSize: '0.78rem', color: '#0CAF60', fontWeight: 700 }}>
                Ruta directa
              </div>
            )}

            {!isDirect && (
              <button
                type="button"
                onClick={() => openItineraryBooking(routeObj, title)}
                style={{
                  marginTop: '14px',
                  padding: '10px 16px',
                  background: 'linear-gradient(135deg, #3960FB 0%, #1A2EB5 100%)',
                  border: 'none',
                  borderRadius: '999px',
                  color: '#fff',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
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
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#142258', marginBottom: '6px' }}>
          {t('searchTitle')}
        </h1>
        <p style={{ color: '#6B7A99', fontSize: '0.9rem' }}>{t('searchSubtitle')}</p>
      </div>

      <div
        className="card fade-up"
        style={{ padding: '28px', marginBottom: '28px', background: '#ffffff', borderRadius: '24px' }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '16px', marginBottom: '24px' }}>
          <div ref={originRef} style={{ position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#142258', fontSize: '0.75rem' }}>
              <i className="fa-solid fa-plane-departure" style={{ marginRight: '6px' }} />
              {t('origin')}
            </label>

            <div
              onClick={() => {
                setOriginDropdownOpen(!originDropdownOpen);
                if (origin) setOriginSearchTerm(origin.code);
              }}
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
                    <div style={{ fontWeight: 700, color: '#142258' }}>{origin.code}</div>
                    <div style={{ fontSize: '0.7rem', color: '#6B7A99' }}>Origen</div>
                  </div>
                  <span
                    style={{
                      background: '#F1F5FF',
                      padding: '2px 8px',
                      borderRadius: '20px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: '#3960FB'
                    }}
                  >
                    {origin.code}
                  </span>
                </div>
              ) : (
                <span style={{ color: '#B0BBD5' }}>{t('originPlaceholder')}</span>
              )}
            </div>

            {originDropdownOpen && (
              <div
                style={{
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
                }}
              >
                <div style={{ padding: '12px', borderBottom: '1px solid #F1F5FF' }}>
                  <input
                    type="text"
                    placeholder="Buscar aeropuerto..."
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
                        setRouteOptions(null);
                        setDirectFlights([]);
                        setSearched(false);
                        setSelectedItinerary(null);
                        setSelectedItineraryLabel('');
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
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <i className="fa-solid fa-plane" style={{ color: '#3960FB' }} />
                      <div>
                        <div style={{ fontWeight: 700, color: '#142258' }}>{airport.code}</div>
                        <div style={{ fontSize: '0.7rem', color: '#6B7A99' }}>Aeropuerto</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#3960FB' }}>{airport.code}</div>
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
              onClick={() => {
                if (!origin) return;
                setDestDropdownOpen(!destDropdownOpen);
                if (destination) setDestSearchTerm(destination.code);
              }}
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#142258' }}>{destination.code}</div>
                    <div style={{ fontSize: '0.7rem', color: '#6B7A99' }}>
                      {destination.stops === 0 ? 'Directo' : `${destination.stops} escala(s)`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        background: '#F1F5FF',
                        padding: '2px 8px',
                        borderRadius: '20px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        color: '#3960FB'
                      }}
                    >
                      {destination.code}
                    </span>
                    <div style={{ fontSize: '0.72rem', color: '#1A2EB5', fontWeight: 700, marginTop: '4px' }}>
                      {formatMoney(destination.totalCost)}
                    </div>
                  </div>
                </div>
              ) : (
                <span style={{ color: '#B0BBD5' }}>
                  {origin ? t('destPlaceholder') : 'Primero selecciona un origen'}
                </span>
              )}
            </div>

            {destDropdownOpen && origin && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#ffffff',
                  borderRadius: '16px',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12)',
                  marginTop: '8px',
                  zIndex: 1000,
                  maxHeight: '360px',
                  overflowY: 'auto',
                  border: '1px solid #F1F5FF'
                }}
              >
                <div style={{ padding: '12px', borderBottom: '1px solid #F1F5FF' }}>
                  <input
                    type="text"
                    placeholder="Buscar aeropuerto..."
                    value={destSearchTerm}
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
                      borderBottom: '1px solid #F8FAFC',
                      gap: '12px'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F8FAFC')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <i className="fa-solid fa-route" style={{ color: '#3960FB' }} />
                      <div>
                        <div style={{ fontWeight: 700, color: '#142258' }}>{airport.code}</div>
                        <div style={{ fontSize: '0.7rem', color: '#6B7A99' }}>
                          {airport.stops === 0 ? 'Directo' : `${airport.stops} escala(s)`}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: '#3960FB' }}>{airport.code}</div>
                      <div style={{ fontSize: '0.7rem', color: '#1A2EB5', fontWeight: 700 }}>
                        {formatMoney(airport.totalCost)}
                      </div>
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

        {origin && destination && (
          <div style={{ marginBottom: '16px', fontSize: '0.75rem', color: '#6B7A99', textAlign: 'center' }}>
            {destination.stops === 0
              ? `Ruta directa disponible · desde ${formatMoney(destination.totalCost)}`
              : `Ruta alcanzable con ${destination.stops} escala(s) · desde ${formatMoney(destination.totalCost)}`}
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
          {routeOptions?.success ? (
            <div style={{ marginBottom: '24px' }}>
              {renderRouteSummary(routeOptions.cheapest, 'Ruta más barata')}
              {routeOptions.fastest &&
              routeOptions.cheapest &&
              JSON.stringify(routeOptions.fastest.route) !== JSON.stringify(routeOptions.cheapest.route)
                ? renderRouteSummary(routeOptions.fastest, 'Ruta más rápida')
                : null}
            </div>
          ) : null}

          {directFlights.length > 0 ? (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                  flexWrap: 'wrap'
                }}
              >
                <p style={{ fontWeight: 700, color: '#142258' }}>
                  {totalResults > 0
                    ? `${totalResults.toLocaleString()} vuelo(s) directo(s) encontrados`
                    : 'No se encontraron vuelos directos'}
                </p>

                {totalPages > 0 && (
                  <div style={{ display: 'flex', gap: '12px' }}>
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {directFlights.map((flight) => (
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
                          <span
                            style={{
                              marginLeft: '12px',
                              fontSize: '0.7rem',
                              background: '#E6FBF1',
                              padding: '2px 8px',
                              borderRadius: '20px',
                              color: '#0CAF60'
                            }}
                          >
                            {flight.status}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{flight.origin_code}</span>
                            <div style={{ fontSize: '0.7rem', color: '#6B7A99' }}>
                              {formatTime(flight.departure_time)}
                            </div>
                          </div>

                          <div style={{ flex: 1, textAlign: 'center' }}>
                            <i className="fa-solid fa-plane" style={{ color: '#3960FB' }} />
                          </div>

                          <div style={{ textAlign: 'center' }}>
                            <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>{flight.destination_code}</span>
                            <div style={{ fontSize: '0.7rem', color: '#6B7A99' }}>
                              {formatTime(flight.arrival_time || '--:--')}
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: '8px', fontSize: '0.7rem', color: '#6B7A99' }}>
                          {formatDate(flight.departure_date)} · Puerta {flight.gate || 'TBD'}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.6rem', color: '#B0BBD5' }}>Desde</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3960FB' }}>
                          {formatMoney(flight.economy_price || 250)}
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
            </div>
          ) : routeOptions?.success ? (
            <div style={{ textAlign: 'center', padding: '32px', background: '#fff', borderRadius: '24px' }}>
              <p style={{ fontWeight: 700, color: '#142258', marginBottom: '8px' }}>
                Se encontraron rutas óptimas para este destino.
              </p>
              <p style={{ fontSize: '0.9rem', color: '#6B7A99' }}>
                Usa el botón <strong>Seleccionar itinerario</strong> en una de las rutas con escalas para continuar con la reserva o compra.
              </p>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '60px', background: '#fff', borderRadius: '24px' }}>
              <p>No se encontraron rutas para los filtros seleccionados.</p>
              <p style={{ fontSize: '0.8rem', color: '#6B7A99' }}>
                Prueba con otro destino o con fechas entre {dateRange.min || 'marzo'} y {dateRange.max || 'abril'} 2026
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}