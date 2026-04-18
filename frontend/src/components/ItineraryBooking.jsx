import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

export default function ItineraryBooking({
  apiUrl,
  routeOption,
  startDate,
  endDate,
  classType = 'ECONOMY',
  onComplete,
  onCancel
}) {
  const API_URL = apiUrl || 'http://localhost:3001/api/v1';

  const [loadingQuote, setLoadingQuote] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [quoteData, setQuoteData] = useState(null);
  const [segmentSeats, setSegmentSeats] = useState({});
  const [selectedSeats, setSelectedSeats] = useState({});
  const [passengerId, setPassengerId] = useState(null);
  const [passengerFound, setPassengerFound] = useState(false);
  const [lookingUpPassenger, setLookingUpPassenger] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const [purchaseResult, setPurchaseResult] = useState(null);
  const [walletQr, setWalletQr] = useState(null);
  const [walletViewUrl, setWalletViewUrl] = useState(null);
  const [googleWalletUrl, setGoogleWalletUrl] = useState(null);
  const [loadingWallet, setLoadingWallet] = useState(false);

  const [feedback, setFeedback] = useState({
    type: '',
    message: ''
  });

  const [formData, setFormData] = useState({
    passportNumber: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });

  const MIN_DATE = new Date('2026-03-25');
  const MAX_DATE = new Date('2026-04-05');

  const normalizedSegments = useMemo(() => {
    if (!routeOption?.route || !Array.isArray(routeOption.route)) return [];
    return routeOption.route.map((segment) => ({
      origin: segment.from,
      destination: segment.to,
      startDate: startDate || undefined,
      endDate: endDate || undefined
    }));
  }, [routeOption, startDate, endDate]);

  useEffect(() => {
    if (!normalizedSegments.length) {
      setLoadingQuote(false);
      setFeedback({
        type: 'error',
        message: 'No hay segmentos válidos para este itinerario.'
      });
      return;
    }

    if (startDate) {
      const selectedDate = new Date(startDate);
      if (selectedDate < MIN_DATE || selectedDate > MAX_DATE) {
        setLoadingQuote(false);
        setFeedback({
          type: 'error',
          message: `La fecha seleccionada (${formatDate(startDate)}) está fuera del rango disponible.`
        });
        return;
      }
    }

    loadQuote();
  }, [normalizedSegments, startDate]);

  const formatMoney = (amount) => {
    return `$${Number(amount || 0).toLocaleString()}`;
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

  const buildQuotePayload = () => {
    return {
      classType,
      segments: normalizedSegments
    };
  };

  const buildActionPayload = (ensuredPassengerId) => {
    return {
      passengerId: ensuredPassengerId,
      classType,
      segments: (quoteData?.segments || []).map((segment) => ({
        origin: segment.origin,
        destination: segment.destination,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        preferredFlightId: segment.flightId,
        seatNumber: selectedSeats[segment.flightId]
      }))
    };
  };

// Reemplazar la función loadQuote por esta:

const loadQuote = async () => {
    setLoadingQuote(true);
    setFeedback({ type: '', message: '' });

    // Validar que todos los segmentos tengan vuelos disponibles
    try {
        // Verificar cada segmento antes de cotizar
        for (const segment of normalizedSegments) {
            const checkResponse = await axios.get(`${API_URL}/flights`, {
                params: {
                    origin: segment.origin,
                    destination: segment.destination,
                    startDate: startDate || undefined,
                    endDate: endDate || undefined,
                    limit: 1,
                    page: 1
                }
            });
            
            if (!checkResponse.data.success || checkResponse.data.total === 0) {
                throw new Error(`No hay vuelos disponibles para ${segment.origin} → ${segment.destination} en las fechas seleccionadas`);
            }
        }
        
        const response = await axios.post(`${API_URL}/itinerary/quote`, buildQuotePayload());
        const data = response.data;

        if (!data.success) {
            throw new Error(data.error || 'No se pudo cotizar el itinerario.');
        }

        setQuoteData(data);
        await loadSeatsForSegments(data.segments || []);
    } catch (error) {
        let errorMessage = error.response?.data?.error || error.message || 'Error al cargar el itinerario.';
        
        if (errorMessage.includes('No se encontró vuelo')) {
            errorMessage = errorMessage + ' Por favor, selecciona otra ruta o fechas diferentes.';
        }
        
        setFeedback({
            type: 'error',
            message: errorMessage
        });
        setQuoteData(null);
    } finally {
        setLoadingQuote(false);
    }
};

  const loadSeatsForSegments = async (segments) => {
    const seatsMap = {};
    for (const segment of segments) {
      try {
        const response = await axios.get(`${API_URL}/flights/${segment.flightId}/seats`);
        seatsMap[segment.flightId] = response.data.seats || [];
      } catch (error) {
        console.error(`Error loading seats for segment ${segment.flightId}:`, error);
        seatsMap[segment.flightId] = [];
      }
    }
    setSegmentSeats(seatsMap);
  };

  const handlePassengerInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'passportNumber') {
      setPassengerFound(false);
      setPassengerId(null);
    }
  };

  const handlePassengerLookup = async () => {
    const passport = formData.passportNumber.trim();
    if (!passport) return;

    setLookingUpPassenger(true);
    try {
      const response = await axios.get(`${API_URL}/passenger/search`, { params: { passport } });
      const p = response.data;
      setFormData((prev) => ({
        ...prev,
        firstName: p.first_name || '',
        lastName: p.last_name || '',
        email: p.email || '',
        phone: p.phone || ''
      }));
      setPassengerFound(true);
      setPassengerId(p.id || null);
      setFeedback({ type: 'success', message: 'Pasajero encontrado y cargado correctamente.' });
    } catch (error) {
      setPassengerFound(false);
      setPassengerId(null);
    } finally {
      setLookingUpPassenger(false);
    }
  };

  const ensurePassenger = async () => {
    if (!formData.passportNumber.trim() || !formData.firstName.trim() || !formData.lastName.trim()) {
      throw new Error('Completa pasaporte, nombre y apellido.');
    }
    if (passengerId) return passengerId;

    const response = await axios.post(`${API_URL}/passenger`, {
      passport_number: formData.passportNumber.trim(),
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim(),
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null
    });
    const newPassengerId = response.data.id;
    setPassengerId(newPassengerId);
    return newPassengerId;
  };

  const selectSeat = (flightId, seatNumber, status) => {
    if (status !== 'AVAILABLE') return;
    setSelectedSeats((prev) => ({ ...prev, [flightId]: seatNumber }));
  };

  const validateSeatSelection = () => {
    const segments = quoteData?.segments || [];
    for (const segment of segments) {
      if (!selectedSeats[segment.flightId]) {
        throw new Error(`Debes seleccionar un asiento para el tramo ${segment.origin} → ${segment.destination}.`);
      }
    }
  };

  const handleReserveItinerary = async () => {
    setLoadingAction(true);
    setFeedback({ type: '', message: '' });
    try {
      validateSeatSelection();
      const ensuredPassengerId = await ensurePassenger();
      const response = await axios.post(`${API_URL}/itinerary/reserve`, buildActionPayload(ensuredPassengerId));
      if (response.data.success) {
        setPurchaseResult(response.data);
        if (onComplete) onComplete(response.data);
      } else {
        throw new Error(response.data.error || 'No se pudo reservar el itinerario.');
      }
    } catch (error) {
      setFeedback({ type: 'error', message: error.response?.data?.error || error.message || 'Error al reservar el itinerario.' });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleBuyItinerary = async () => {
    setLoadingAction(true);
    setFeedback({ type: '', message: '' });
    try {
      validateSeatSelection();
      const ensuredPassengerId = await ensurePassenger();
      const response = await axios.post(`${API_URL}/itinerary/buy`, buildActionPayload(ensuredPassengerId));
      if (response.data.success) {
        setPurchaseResult(response.data);
        if (onComplete) onComplete(response.data);
      } else {
        throw new Error(response.data.error || 'No se pudo comprar el itinerario.');
      }
    } catch (error) {
      setFeedback({ type: 'error', message: error.response?.data?.error || error.message || 'Error al comprar el itinerario.' });
    } finally {
      setLoadingAction(false);
    }
  };

  const handleWallet = async (ticketNumber) => {
    if (walletQr) {
      setWalletQr(null);
      setWalletViewUrl(null);
      setGoogleWalletUrl(null);
      return;
    }
    setLoadingWallet(true);
    try {
      const r = await axios.get(API_URL + '/boarding-pass/wallet?ticket=' + ticketNumber);
      setWalletQr(r.data.qrCode);
      setWalletViewUrl(r.data.viewUrl || null);
      setGoogleWalletUrl(r.data.googleWalletUrl || null);
    } catch (error) {
      console.error('Error fetching wallet:', error);
    } finally {
      setLoadingWallet(false);
    }
  };

  const getSeatClass = (seat, isSelected) => {
    if (isSelected) return 'seat-selected';
    if (seat.status === 'AVAILABLE') return 'seat-available';
    if (seat.status === 'RESERVED') return 'seat-reserved';
    if (seat.status === 'SOLD') return 'seat-sold';
    if (seat.status === 'REFUNDED') return 'seat-refunded';
    return 'seat-available';
  };

  const getSeatLabel = (status) => {
    if (status === 'AVAILABLE') return 'Disponible';
    if (status === 'RESERVED') return 'Reservado';
    if (status === 'SOLD') return 'Vendido';
    if (status === 'REFUNDED') return 'En devolución';
    return 'Disponible';
  };

  const currentSegment = quoteData?.segments?.[activeSegmentIndex];
  const currentSeats = currentSegment ? (segmentSeats[currentSegment.flightId] || []) : [];
  const firstClassSeats = currentSeats.filter(s => s.class_type === 'FIRST');
  const economySeats = currentSeats.filter(s => s.class_type === 'ECONOMY');
  const availableCount = currentSeats.filter(s => s.status === 'AVAILABLE').length;
  const soldCount = currentSeats.filter(s => s.status === 'SOLD').length;
  const reservedCount = currentSeats.filter(s => s.status === 'RESERVED').length;
  const occupancy = currentSeats.length > 0 ? Math.round((soldCount / currentSeats.length) * 100) : 0;

  // Si ya se completó la compra, mostrar resultado con PDF y Wallet para cada vuelo
  if (purchaseResult) {
    const passengerName = `${formData.firstName} ${formData.lastName}`;
    
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ background: 'linear-gradient(145deg, #3960FB 0%, #0D1D5A 100%)', padding: '22px 26px 20px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <p style={{ fontSize: '0.62rem', letterSpacing: '0.16em', opacity: 0.65, textTransform: 'uppercase' }}>
                <i className="fa-solid fa-ticket" style={{ marginRight: '6px' }} /> ITINERARIO COMPRADO
              </p>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, opacity: 0.85 }}>
                {purchaseResult.totalSegments || quoteData?.totalSegments} tramos
              </span>
            </div>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '8px' }}>✅</div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '8px' }}>¡Itinerario Confirmado!</h2>
              <p style={{ fontSize: '0.75rem', opacity: 0.8 }}>{purchaseResult.message || 'Tu reserva ha sido procesada exitosamente'}</p>
            </div>
          </div>

          <div style={{ position: 'relative', height: '18px', background: '#EBEFFF', display: 'flex', alignItems: 'center' }}>
            <div style={{ position: 'absolute', left: '-10px', width: '20px', height: '20px', borderRadius: '50%', background: '#EBEFFF', zIndex: 2 }} />
            <div style={{ position: 'absolute', right: '-10px', width: '20px', height: '20px', borderRadius: '50%', background: '#EBEFFF', zIndex: 2 }} />
            <div style={{ flex: 1, height: '1.5px', margin: '0 14px', background: 'repeating-linear-gradient(90deg, #C2CEFE 0, #C2CEFE 6px, transparent 6px, transparent 12px)' }} />
          </div>

          <div style={{ padding: '18px 26px 22px' }}>
            <h3 style={{ fontWeight: 800, color: '#142258', fontSize: '0.9rem', marginBottom: '12px' }}>📋 Boletos del itinerario</h3>
            
            {quoteData?.segments?.map((seg, idx) => {
              const sale = purchaseResult.segments?.find(s => s.flightId === seg.flightId)?.sale;
              const ticketNumber = sale?.ticket_number || purchaseResult.segments?.find(s => s.flightId === seg.flightId)?.ticketNumber;
              const seatNumber = selectedSeats[seg.flightId];
              const price = seg.price;
              const isFirst = seg.classType === 'FIRST';
              
              return (
                <div key={idx} style={{ 
                  marginBottom: '20px', 
                  padding: '16px', 
                  background: '#F7F9FF', 
                  borderRadius: '16px',
                  border: '1px solid #E2E8F0'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#142258' }}>
                        {seg.origin} → {seg.destination}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#6B7A99', marginTop: '2px' }}>
                        Vuelo {seg.flightNumber} · {formatDate(seg.departureDate)} · {formatTime(seg.departureTime)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#3960FB' }}>{formatMoney(price)}</div>
                      <div style={{ fontSize: '0.7rem', color: isFirst ? '#D97706' : '#6B7A99' }}>
                        {isFirst ? 'Primera Clase' : 'Clase Turista'}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingTop: '12px', borderTop: '1px solid #E2E8F0' }}>
                    <div>
                      <span style={{ fontSize: '0.6rem', color: '#9AAAC2' }}>ASIENTO</span>
                      <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#142258' }}>{seatNumber}</div>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.6rem', color: '#9AAAC2' }}>PUERTA</span>
                      <div style={{ fontWeight: 700, color: '#142258' }}>{seg.gate || 'TBD'}</div>
                    </div>
                    {ticketNumber && (
                      <div>
                        <span style={{ fontSize: '0.6rem', color: '#9AAAC2' }}>TICKET</span>
                        <div style={{ fontWeight: 700, fontSize: '0.7rem', color: '#142258' }}>{ticketNumber}</div>
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                    <button
                      className="btn-primary"
                      style={{ flex: 1, padding: '10px', fontSize: '0.75rem', borderRadius: '30px' }}
                      onClick={() => window.open(API_URL + '/boarding-pass/pdf?ticket=' + ticketNumber, '_blank')}
                    >
                      <i className="fa-solid fa-file-pdf" /> Descargar PDF
                    </button>
                    <button
                      className="btn-outline"
                      style={{ flex: 1, padding: '10px', fontSize: '0.75rem', borderRadius: '30px' }}
                      onClick={() => handleWallet(ticketNumber)}
                    >
                      {loadingWallet ? <i className="fa-solid fa-circle-notch fa-spin" /> : <><i className="fa-solid fa-qrcode" /> Wallet</>}
                    </button>
                  </div>
                  
                  {/* QR Wallet para este vuelo */}
                  {walletQr && (
                    <div style={{ marginTop: '16px', padding: '12px', background: '#0D1B4B', borderRadius: '12px', textAlign: 'center' }}>
                      <img src={walletQr} alt="Wallet QR" style={{ width: '120px', height: '120px', margin: '0 auto' }} />
                      <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.6)', marginTop: '8px' }}>Escanea para agregar a Wallet</p>
                      {googleWalletUrl && (
                        <a href={googleWalletUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '8px', color: '#fff', fontSize: '0.7rem' }}>
                          Guardar en Google Wallet
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            
            <div style={{ marginTop: '16px', padding: '12px', background: '#F1F5FF', borderRadius: '12px', textAlign: 'center' }}>
              <strong>Total pagado:</strong> {formatMoney(purchaseResult.totalPaid || quoteData?.totalPrice)}
            </div>

            <div style={{ background: '#F7F9FF', borderRadius: '10px', padding: '10px 14px', marginTop: '16px' }}>
              <p style={{ fontSize: '0.6rem', fontWeight: 700, color: '#9AAAC2' }}>PASAJERO</p>
              <p style={{ fontWeight: 700, color: '#142258' }}>{passengerName}</p>
              <p style={{ fontSize: '0.7rem', color: '#6B7A99' }}>{formData.passportNumber}</p>
            </div>

            <button className="btn-ghost" style={{ width: '100%', marginTop: '20px' }} onClick={onCancel}>
              <i className="fa-solid fa-rotate-right" /> Nueva Reserva
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loadingQuote) {
    return (
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '56px' }}>
          <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#3960FB' }} />
          <p style={{ marginTop: '16px', color: '#6B7A99' }}>Cargando itinerario...</p>
        </div>
      </div>
    );
  }

  if (!quoteData?.success && feedback.message) {
    return (
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '2rem', color: '#EF4444' }} />
          <h2 style={{ marginTop: '16px', color: '#142258' }}>No se pudo cargar el itinerario</h2>
          <p style={{ color: '#EF4444', marginTop: '8px' }}>{feedback.message}</p>
          <button className="btn-primary" style={{ marginTop: '24px' }} onClick={onCancel}>Volver</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
      <button className="btn-back" style={{ marginBottom: '20px' }} onClick={onCancel}>
        ← Volver a resultados
      </button>

      <div className="card" style={{ padding: '28px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#142258' }}>Compra de itinerario con escalas</h2>
          <p style={{ color: '#6B7A99', marginTop: '6px' }}>Selecciona un asiento para cada tramo del viaje.</p>
          {startDate && <p style={{ fontSize: '0.8rem', color: '#3960FB', marginTop: '8px' }}>📅 Fecha: {formatDate(startDate)}</p>}
        </div>

        {feedback.message && (
          <div style={{
            padding: '14px 16px',
            borderRadius: '12px',
            marginBottom: '20px',
            background: feedback.type === 'success' ? '#E6FBF1' : '#FEF2F2',
            color: feedback.type === 'success' ? '#0C8F52' : '#EF4444'
          }}>
            {feedback.message}
          </div>
        )}

        {/* Selector de segmentos */}
        {quoteData?.segments?.length > 1 && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap', borderBottom: '1px solid #E2E8F0', paddingBottom: '16px' }}>
            {quoteData.segments.map((seg, idx) => (
              <button
                key={idx}
                onClick={() => setActiveSegmentIndex(idx)}
                style={{
                  padding: '10px 20px',
                  borderRadius: '40px',
                  border: 'none',
                  background: activeSegmentIndex === idx ? '#3960FB' : '#F1F5FF',
                  color: activeSegmentIndex === idx ? '#fff' : '#142258',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
              >
                {idx + 1}. {seg.origin} → {seg.destination}
                {selectedSeats[seg.flightId] && <span style={{ marginLeft: '8px', fontSize: '0.7rem' }}>✅ {selectedSeats[seg.flightId]}</span>}
              </button>
            ))}
          </div>
        )}

        {/* Mapa de asientos para el segmento actual */}
        {currentSegment && (
          <div style={{ marginBottom: '32px' }}>
            <div style={{ background: '#F7F9FF', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#142258' }}>
                    {currentSegment.origin} → {currentSegment.destination}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#6B7A99', marginTop: '4px' }}>
                    Vuelo {currentSegment.flightNumber} · {formatDate(currentSegment.departureDate)} · {formatTime(currentSegment.departureTime)} · Puerta {currentSegment.gate || 'TBD'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3960FB' }}>{formatMoney(currentSegment.price)}</div>
                  <div style={{ fontSize: '0.7rem', color: '#6B7A99' }}>{currentSegment.classType}</div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
              {[
                { label: 'Disponibles', value: availableCount, icon: 'fa-circle-check', color: '#3960FB', bg: '#EBEFFF' },
                { label: 'Reservados', value: reservedCount, icon: 'fa-clock', color: '#D97706', bg: '#FEF9C3' },
                { label: 'Vendidos', value: soldCount, icon: 'fa-circle-xmark', color: '#6B7A99', bg: '#F3F4F6' },
                { label: 'Ocupación', value: occupancy + '%', icon: 'fa-chart-simple', color: '#0CAF60', bg: '#E6FBF1' },
              ].map(({ label, value, icon, color, bg }) => (
                <div key={label} style={{ background: bg, borderRadius: '14px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className={`fa-solid ${icon}`} style={{ color, fontSize: '0.88rem' }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '1.25rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
                    <p style={{ fontSize: '0.65rem', fontWeight: 600, color, opacity: 0.75 }}>{label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Primera Clase */}
            {firstClassSeats.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontWeight: 800, color: '#D97706', marginBottom: '12px' }}>✨ Primera Clase</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                  {firstClassSeats.map(seat => {
                    const isSelected = selectedSeats[currentSegment.flightId] === seat.seat_number;
                    return (
                      <button
                        key={seat.seat_number}
                        onClick={() => selectSeat(currentSegment.flightId, seat.seat_number, seat.status)}
                        disabled={seat.status !== 'AVAILABLE'}
                        style={{
                          padding: '12px 0',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid #1A2EB5' : 'none',
                          background: isSelected ? '#DDE7FF' : seat.status === 'AVAILABLE' ? '#FEF3C7' : seat.status === 'RESERVED' ? '#FEF9C3' : seat.status === 'SOLD' ? '#E5E7EB' : '#FEE2E2',
                          color: seat.status === 'AVAILABLE' || isSelected ? '#142258' : '#6B7280',
                          cursor: seat.status === 'AVAILABLE' ? 'pointer' : 'not-allowed',
                          fontWeight: 700,
                          fontSize: '0.8rem'
                        }}
                        title={getSeatLabel(seat.status)}
                      >
                        {seat.seat_number}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Clase Turista */}
            {economySeats.length > 0 && (
              <div>
                <h3 style={{ fontWeight: 800, color: '#3960FB', marginBottom: '12px' }}>✈️ Clase Turista</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px' }}>
                  {economySeats.map(seat => {
                    const isSelected = selectedSeats[currentSegment.flightId] === seat.seat_number;
                    return (
                      <button
                        key={seat.seat_number}
                        onClick={() => selectSeat(currentSegment.flightId, seat.seat_number, seat.status)}
                        disabled={seat.status !== 'AVAILABLE'}
                        style={{
                          padding: '12px 0',
                          borderRadius: '10px',
                          border: isSelected ? '2px solid #1A2EB5' : 'none',
                          background: isSelected ? '#DDE7FF' : seat.status === 'AVAILABLE' ? '#DBEAFE' : seat.status === 'RESERVED' ? '#FEF9C3' : seat.status === 'SOLD' ? '#E5E7EB' : '#FEE2E2',
                          color: seat.status === 'AVAILABLE' || isSelected ? '#142258' : '#6B7280',
                          cursor: seat.status === 'AVAILABLE' ? 'pointer' : 'not-allowed',
                          fontWeight: 700,
                          fontSize: '0.8rem'
                        }}
                        title={getSeatLabel(seat.status)}
                      >
                        {seat.seat_number}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Leyenda */}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #F1F5FF' }}>
              {[
                { color: '#DBEAFE', text: 'Disponible' },
                { color: '#FEF3C7', text: 'Primera Clase' },
                { color: '#FEF9C3', text: 'Reservado' },
                { color: '#E5E7EB', text: 'Vendido' },
                { color: '#FEE2E2', text: 'En devolución' },
                { color: '#DDE7FF', text: 'Seleccionado' },
              ].map(({ color, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '20px', height: '16px', borderRadius: '4px', background: color }} />
                  <span style={{ fontSize: '0.7rem', color: '#6B7A99' }}>{text}</span>
                </div>
              ))}
            </div>

            {selectedSeats[currentSegment.flightId] && (
              <div style={{ marginTop: '16px', padding: '12px', background: '#E6FBF1', borderRadius: '10px', textAlign: 'center' }}>
                <i className="fa-solid fa-check-circle" style={{ color: '#0C8F52', marginRight: '8px' }} />
                Asiento <strong>{selectedSeats[currentSegment.flightId]}</strong> seleccionado
              </div>
            )}
          </div>
        )}

        {/* Resumen de selección */}
        {quoteData?.segments && (
          <div style={{ marginBottom: '24px', padding: '16px', background: '#F8FAFC', borderRadius: '16px' }}>
            <h3 style={{ fontWeight: 800, color: '#142258', marginBottom: '12px' }}>📋 Resumen de asientos</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              {quoteData.segments.map(seg => (
                <div key={seg.flightId} style={{ background: '#fff', padding: '8px 16px', borderRadius: '30px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontWeight: 600 }}>{seg.origin} → {seg.destination}</span>
                  <span style={{ marginLeft: '12px', color: selectedSeats[seg.flightId] ? '#0C8F52' : '#EF4444', fontWeight: 700 }}>
                    {selectedSeats[seg.flightId] || '❌ No seleccionado'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Total y datos del pasajero */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div style={{ background: '#F7F9FF', borderRadius: '18px', padding: '20px' }}>
            <div style={{ fontWeight: 800, color: '#142258', marginBottom: '12px' }}>Total del itinerario</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#3960FB' }}>{formatMoney(quoteData?.totalPrice || 0)}</div>
            <div style={{ marginTop: '8px', color: '#6B7A99' }}>{quoteData?.totalSegments || 0} tramo(s) · Clase {classType}</div>
          </div>

          <div style={{ background: '#fff', borderRadius: '18px', padding: '20px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontWeight: 800, color: '#142258', marginBottom: '16px' }}>Datos del pasajero</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input name="passportNumber" value={formData.passportNumber} onChange={handlePassengerInputChange} onBlur={handlePassengerLookup} placeholder="Pasaporte *" style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '12px' }} />
              {lookingUpPassenger && <div style={{ fontSize: '0.7rem', color: '#6B7A99' }}><i className="fa-solid fa-circle-notch fa-spin" /> Buscando...</div>}
              {!lookingUpPassenger && passengerFound && <div style={{ fontSize: '0.7rem', color: '#0C8F52' }}>✅ Pasajero encontrado</div>}
              <input name="firstName" value={formData.firstName} onChange={handlePassengerInputChange} placeholder="Nombre *" style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '12px' }} />
              <input name="lastName" value={formData.lastName} onChange={handlePassengerInputChange} placeholder="Apellido *" style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '12px' }} />
              <input name="email" value={formData.email} onChange={handlePassengerInputChange} placeholder="Email" style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '12px' }} />
              <input name="phone" value={formData.phone} onChange={handlePassengerInputChange} placeholder="Teléfono" style={{ padding: '12px', border: '1px solid #E2E8F0', borderRadius: '12px' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
              <button onClick={handleReserveItinerary} disabled={loadingAction} style={{ padding: '14px', borderRadius: '40px', border: 'none', background: '#F1F5FF', color: '#1A2EB5', fontWeight: 800, cursor: loadingAction ? 'not-allowed' : 'pointer' }}>
                {loadingAction ? <i className="fa-solid fa-circle-notch fa-spin" /> : 'Reservar itinerario'}
              </button>
              <button onClick={handleBuyItinerary} disabled={loadingAction} style={{ padding: '14px', borderRadius: '40px', border: 'none', background: 'linear-gradient(135deg, #3960FB 0%, #1A2EB5 100%)', color: '#fff', fontWeight: 800, cursor: loadingAction ? 'not-allowed' : 'pointer' }}>
                {loadingAction ? <i className="fa-solid fa-circle-notch fa-spin" /> : 'Comprar itinerario'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}