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

    loadQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const loadQuote = async () => {
    setLoadingQuote(true);
    setFeedback({ type: '', message: '' });

    try {
      const response = await axios.post(`${API_URL}/itinerary/quote`, buildQuotePayload());
      const data = response.data;

      if (!data.success) {
        throw new Error(data.error || 'No se pudo cotizar el itinerario.');
      }

      setQuoteData(data);
      await loadSeatsForSegments(data.segments || []);
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error.response?.data?.error ||
          error.message ||
          'Error al cargar el itinerario.'
      });
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
        seatsMap[segment.flightId] = [];
      }
    }

    setSegmentSeats(seatsMap);
  };

  const handlePassengerInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));

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
      const response = await axios.get(`${API_URL}/passenger/search`, {
        params: { passport }
      });

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
      setFeedback({
        type: 'success',
        message: 'Pasajero encontrado y cargado correctamente.'
      });
    } catch {
      setPassengerFound(false);
      setPassengerId(null);
    } finally {
      setLookingUpPassenger(false);
    }
  };

  const ensurePassenger = async () => {
    if (
      !formData.passportNumber.trim() ||
      !formData.firstName.trim() ||
      !formData.lastName.trim()
    ) {
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

    setSelectedSeats((prev) => ({
      ...prev,
      [flightId]: seatNumber
    }));
  };

  const validateSeatSelection = () => {
    const segments = quoteData?.segments || [];

    for (const segment of segments) {
      if (!selectedSeats[segment.flightId]) {
        throw new Error(
          `Debes seleccionar un asiento para el tramo ${segment.origin} → ${segment.destination}.`
        );
      }
    }
  };

  const handleReserveItinerary = async () => {
    setLoadingAction(true);
    setFeedback({ type: '', message: '' });

    try {
      validateSeatSelection();
      const ensuredPassengerId = await ensurePassenger();

      const response = await axios.post(
        `${API_URL}/itinerary/reserve`,
        buildActionPayload(ensuredPassengerId)
      );

      if (response.data.success) {
        setFeedback({
          type: 'success',
          message: response.data.message || 'Itinerario reservado correctamente.'
        });

        if (onComplete) onComplete(response.data);
      } else {
        throw new Error(response.data.error || 'No se pudo reservar el itinerario.');
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error.response?.data?.error ||
          error.message ||
          'Error al reservar el itinerario.'
      });
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

      const response = await axios.post(
        `${API_URL}/itinerary/buy`,
        buildActionPayload(ensuredPassengerId)
      );

      if (response.data.success) {
        setFeedback({
          type: 'success',
          message: response.data.message || 'Itinerario comprado correctamente.'
        });

        if (onComplete) onComplete(response.data);
      } else {
        throw new Error(response.data.error || 'No se pudo comprar el itinerario.');
      }
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error.response?.data?.error ||
          error.message ||
          'Error al comprar el itinerario.'
      });
    } finally {
      setLoadingAction(false);
    }
  };

  const feedbackStyles = {
    success: {
      background: '#EAFBF3',
      color: '#0C8F52',
      border: '1px solid #BEECD2'
    },
    error: {
      background: '#FFF1F2',
      color: '#C62828',
      border: '1px solid #F5C2C7'
    },
    warning: {
      background: '#FFF8E6',
      color: '#A66B00',
      border: '1px solid #F2D48A'
    }
  };

  if (loadingQuote) {
    return (
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div
          style={{
            background: '#fff',
            borderRadius: '24px',
            padding: '32px',
            textAlign: 'center'
          }}
        >
          Cargando itinerario...
        </div>
      </div>
    );
  }

  if (!quoteData?.success) {
    return (
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <div
          style={{
            background: '#fff',
            borderRadius: '24px',
            padding: '32px'
          }}
        >
          <h2 style={{ color: '#142258', marginBottom: '12px' }}>
            No se pudo cargar el itinerario
          </h2>

          {feedback.message && (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                ...(feedbackStyles[feedback.type] || feedbackStyles.error)
              }}
            >
              {feedback.message}
            </div>
          )}

          <button
            onClick={onCancel}
            style={{
              marginTop: '20px',
              padding: '12px 20px',
              borderRadius: '999px',
              border: 'none',
              background: '#3960FB',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <button
        onClick={onCancel}
        style={{
          marginBottom: '20px',
          padding: '10px 16px',
          borderRadius: '999px',
          border: '1px solid #D9E2F2',
          background: '#fff',
          color: '#142258',
          cursor: 'pointer',
          fontWeight: 700
        }}
      >
        ← Volver a resultados
      </button>

      <div
        style={{
          background: '#fff',
          borderRadius: '24px',
          padding: '28px',
          marginBottom: '20px'
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#142258' }}>
            Compra de itinerario con escalas
          </h2>
          <p style={{ color: '#6B7A99', marginTop: '6px' }}>
            Selecciona un asiento para cada tramo y completa los datos del pasajero.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: '18px',
            alignItems: 'start'
          }}
        >
          <div
            style={{
              background: '#F7F9FF',
              borderRadius: '18px',
              padding: '18px',
              border: '1px solid #EBEFFF'
            }}
          >
            <div style={{ fontWeight: 800, color: '#142258', marginBottom: '14px' }}>
              Resumen del itinerario
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {quoteData.segments.map((segment, index) => (
                <div
                  key={`${segment.flightId}-${index}`}
                  style={{
                    background: '#fff',
                    borderRadius: '16px',
                    padding: '14px 16px',
                    border: '1px solid #E8EEFF'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '16px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, color: '#142258' }}>
                        {segment.origin} → {segment.destination}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: '#6B7A99', marginTop: '4px' }}>
                        Vuelo {segment.flightNumber} · {formatDate(segment.departureDate)} · {formatTime(segment.departureTime)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: '#3960FB' }}>
                        {formatMoney(segment.price)}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#6B7A99' }}>
                        {segment.classType}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '14px' }}>
                    <div
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        color: '#142258',
                        marginBottom: '8px'
                      }}
                    >
                      Selecciona asiento
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(6, minmax(44px, 1fr))',
                        gap: '8px'
                      }}
                    >
                      {(segmentSeats[segment.flightId] || []).slice(0, 36).map((seat) => {
                        const isSelected = selectedSeats[segment.flightId] === seat.seat_number;
                        const isAvailable = seat.status === 'AVAILABLE';

                        return (
                          <button
                            key={seat.seat_number}
                            type="button"
                            onClick={() =>
                              selectSeat(segment.flightId, seat.seat_number, seat.status)
                            }
                            disabled={!isAvailable}
                            style={{
                              padding: '10px 0',
                              borderRadius: '10px',
                              border: isSelected
                                ? '2px solid #1A2EB5'
                                : '1px solid #D9E2F2',
                              background: isSelected
                                ? '#DDE7FF'
                                : isAvailable
                                  ? '#fff'
                                  : '#F3F4F6',
                              color: isAvailable ? '#142258' : '#9CA3AF',
                              cursor: isAvailable ? 'pointer' : 'not-allowed',
                              fontWeight: 700,
                              fontSize: '0.78rem'
                            }}
                          >
                            {seat.seat_number}
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ marginTop: '10px', fontSize: '0.76rem', color: '#6B7A99' }}>
                      Solo se muestran los primeros asientos para selección rápida.
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div
              style={{
                background: '#F7F9FF',
                borderRadius: '18px',
                padding: '18px',
                border: '1px solid #EBEFFF',
                marginBottom: '18px'
              }}
            >
              <div style={{ fontWeight: 800, color: '#142258', marginBottom: '12px' }}>
                Total del itinerario
              </div>

              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#3960FB' }}>
                {formatMoney(quoteData.totalPrice)}
              </div>

              <div style={{ marginTop: '8px', color: '#6B7A99', fontSize: '0.85rem' }}>
                {quoteData.totalSegments} tramo(s) · Clase {classType}
              </div>
            </div>

            <div
              style={{
                background: '#fff',
                borderRadius: '18px',
                padding: '18px',
                border: '1px solid #EBEFFF'
              }}
            >
              <div style={{ fontWeight: 800, color: '#142258', marginBottom: '14px' }}>
                Datos del pasajero
              </div>

              {feedback.message && (
                <div
                  style={{
                    marginBottom: '14px',
                    padding: '12px 14px',
                    borderRadius: '12px',
                    ...(feedbackStyles[feedback.type] || feedbackStyles.warning)
                  }}
                >
                  {feedback.message}
                </div>
              )}

              <div style={{ display: 'grid', gap: '12px' }}>
                <input
                  name="passportNumber"
                  value={formData.passportNumber}
                  onChange={handlePassengerInputChange}
                  onBlur={handlePassengerLookup}
                  placeholder="Pasaporte"
                  style={{
                    padding: '14px 16px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '14px',
                    outline: 'none'
                  }}
                />

                {lookingUpPassenger && (
                  <div style={{ fontSize: '0.76rem', color: '#6B7A99' }}>
                    Buscando pasajero...
                  </div>
                )}

                {!lookingUpPassenger && passengerFound && (
                  <div style={{ fontSize: '0.76rem', color: '#0C8F52' }}>
                    Pasajero encontrado.
                  </div>
                )}

                <input
                  name="firstName"
                  value={formData.firstName}
                  onChange={handlePassengerInputChange}
                  placeholder="Nombre"
                  style={{
                    padding: '14px 16px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '14px',
                    outline: 'none'
                  }}
                />

                <input
                  name="lastName"
                  value={formData.lastName}
                  onChange={handlePassengerInputChange}
                  placeholder="Apellido"
                  style={{
                    padding: '14px 16px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '14px',
                    outline: 'none'
                  }}
                />

                <input
                  name="email"
                  value={formData.email}
                  onChange={handlePassengerInputChange}
                  placeholder="Correo electrónico"
                  style={{
                    padding: '14px 16px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '14px',
                    outline: 'none'
                  }}
                />

                <input
                  name="phone"
                  value={formData.phone}
                  onChange={handlePassengerInputChange}
                  placeholder="Teléfono"
                  style={{
                    padding: '14px 16px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '18px' }}>
                <button
                  type="button"
                  onClick={handleReserveItinerary}
                  disabled={loadingAction}
                  style={{
                    padding: '14px 18px',
                    borderRadius: '999px',
                    border: 'none',
                    background: '#F1F5FF',
                    color: '#1A2EB5',
                    fontWeight: 800,
                    cursor: loadingAction ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loadingAction ? 'Procesando...' : 'Reservar itinerario'}
                </button>

                <button
                  type="button"
                  onClick={handleBuyItinerary}
                  disabled={loadingAction}
                  style={{
                    padding: '14px 18px',
                    borderRadius: '999px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #3960FB 0%, #1A2EB5 100%)',
                    color: '#fff',
                    fontWeight: 800,
                    cursor: loadingAction ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loadingAction ? 'Procesando...' : 'Comprar itinerario'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}