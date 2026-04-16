import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

export default function BookingForm({ apiUrl, flight, seat, onComplete, onCancel }) {
  const API_URL = apiUrl || 'http://localhost:3001/api/v1';
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [passengerFound, setPassengerFound] = useState(false);
  const [passengerId, setPassengerId] = useState(null);

  const [reserved, setReserved] = useState(false);
  const [reservationExpiresAt, setReservationExpiresAt] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const [feedback, setFeedback] = useState({
    type: '',
    message: ''
  });

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    passportNumber: '',
    email: '',
    phone: ''
  });

  const isFirst = seat.class_type === 'FIRST';
  const price = isFirst ? flight.first_class_price : flight.economy_price;

  const formattedPrice = useMemo(() => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(Number(price) || 0);
  }, [price]);

  useEffect(() => {
    if (!reservationExpiresAt) {
      setSecondsLeft(0);
      return;
    }

    const updateCountdown = () => {
      const diff = Math.max(
        0,
        Math.floor((new Date(reservationExpiresAt).getTime() - Date.now()) / 1000)
      );

      setSecondsLeft(diff);

      if (diff <= 0) {
        setReserved(false);
        setReservationExpiresAt(null);
        setFeedback({
          type: 'warning',
          message: 'La reserva expiró. El asiento volvió a estar disponible.'
        });
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [reservationExpiresAt]);

  const formatCountdown = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleChange = (e) => {
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

  const handlePassportBlur = async () => {
    const passport = formData.passportNumber.trim();
    if (!passport) return;

    setLookingUp(true);
    try {
      const res = await axios.get(API_URL + '/passenger/search', {
        params: { passport }
      });

      const p = res.data;

      setFormData((prev) => ({
        ...prev,
        firstName: p.first_name || prev.firstName,
        lastName: p.last_name || prev.lastName,
        email: p.email || prev.email,
        phone: p.phone || prev.phone
      }));

      setPassengerFound(true);
      setPassengerId(p.id || null);
      setFeedback({
        type: 'success',
        message: 'Pasajero encontrado. Datos cargados automáticamente.'
      });
    } catch {
      setPassengerFound(false);
      setPassengerId(null);
    } finally {
      setLookingUp(false);
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

    if (passengerId) {
      return passengerId;
    }

    const pRes = await axios.post(API_URL + '/passenger', {
      passport_number: formData.passportNumber.trim(),
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim(),
      email: formData.email.trim() || null,
      phone: formData.phone.trim() || null
    });

    const newPassengerId = pRes.data.id;
    setPassengerId(newPassengerId);
    return newPassengerId;
  };

  const handleReserve = async () => {
    setLoading(true);
    setFeedback({ type: '', message: '' });

    try {
      const ensuredPassengerId = await ensurePassenger();

      const rRes = await axios.post(API_URL + '/seat/reserve', {
        flightId: flight.id,
        seatNumber: seat.seat_number,
        passengerId: ensuredPassengerId,
        classType: seat.class_type
      });

      if (rRes.data.success) {
        const expiresAt = rRes.data.expiresAt || rRes.data.seat?.reservation_expires_at || null;

        setReserved(true);
        setReservationExpiresAt(expiresAt);
        setFeedback({
          type: 'success',
          message: rRes.data.message || 'Asiento reservado por 5 minutos.'
        });
      } else {
        setReserved(false);
        setReservationExpiresAt(null);
        setFeedback({
          type: 'error',
          message: rRes.data.error || 'No se pudo reservar el asiento.'
        });
      }
    } catch (err) {
      setReserved(false);
      setReservationExpiresAt(null);
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || err.message || 'Error al reservar el asiento.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async () => {
    setLoading(true);
    setFeedback({ type: '', message: '' });

    try {
      const ensuredPassengerId = await ensurePassenger();

      

      const sRes = await axios.post(API_URL + '/seat/sell', {
        flightId: flight.id,
        seatNumber: seat.seat_number,
        passengerId: ensuredPassengerId,
        classType: seat.class_type,
        price
      });

      setReserved(false);
      setReservationExpiresAt(null);

      if (onComplete) {
        onComplete(sRes.data);
      }
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Error al completar la compra';

      setFeedback({
        type: 'error',
        message
      });

      if (onComplete) {
        onComplete({ success: false, message });
      }
    } finally {
      setLoading(false);
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

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <button onClick={onCancel} className="btn-back" style={{ marginBottom: '20px' }}>
        <i className="fa-solid fa-arrow-left" />
        {t('backToSeats')}
      </button>

      <div className="card fade-up">
        <div style={{ marginBottom: '24px' }}>
          <h2
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: '#142258',
              marginBottom: '4px'
            }}
          >
            {t('passengerData')}
          </h2>
          <p style={{ color: '#6B7A99', fontSize: '0.88rem' }}>{t('completeInfo')}</p>
        </div>

        <div
          style={{
            background: '#F7F9FF',
            border: '1.5px solid #EBEFFF',
            borderRadius: '14px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr',
            gap: '12px'
          }}
        >
          <div>
            <p
              style={{
                fontSize: '0.62rem',
                fontWeight: 700,
                color: '#6B7A99',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '3px'
              }}
            >
              {t('flight')}
            </p>
            <p style={{ fontWeight: 800, color: '#142258', fontSize: '0.95rem' }}>
              {flight.flight_number}
            </p>
            <p style={{ fontSize: '0.78rem', color: '#3960FB', fontWeight: 600 }}>
              {flight.origin_code} → {flight.destination_code}
            </p>
          </div>

          <div>
            <p
              style={{
                fontSize: '0.62rem',
                fontWeight: 700,
                color: '#6B7A99',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '3px'
              }}
            >
              {t('seat')}
            </p>
            <p style={{ fontWeight: 800, color: '#142258', fontSize: '0.95rem' }}>
              {seat.seat_number}
            </p>
            <p style={{ fontSize: '0.78rem', color: '#3960FB', fontWeight: 600 }}>
              {seat.class_type}
            </p>
          </div>

          <div>
            <p
              style={{
                fontSize: '0.62rem',
                fontWeight: 700,
                color: '#6B7A99',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '3px'
              }}
            >
              {t('date')}
            </p>
            <p style={{ fontWeight: 800, color: '#142258', fontSize: '0.95rem' }}>
              {flight.departure_date}
            </p>
            <p style={{ fontSize: '0.78rem', color: '#3960FB', fontWeight: 600 }}>
              {String(flight.departure_time || '').substring(0, 5)}
            </p>
          </div>

          <div>
            <p
              style={{
                fontSize: '0.62rem',
                fontWeight: 700,
                color: '#6B7A99',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '3px'
              }}
            >
              {t('price')}
            </p>
            <p style={{ fontWeight: 800, color: '#142258', fontSize: '0.95rem' }}>
              {formattedPrice}
            </p>
            <p style={{ fontSize: '0.78rem', color: '#3960FB', fontWeight: 600 }}>
              {isFirst ? 'First Class' : 'Economy'}
            </p>
          </div>
        </div>

        {feedback.message && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 14px',
              borderRadius: '12px',
              fontSize: '0.9rem',
              fontWeight: 600,
              ...(feedbackStyles[feedback.type] || feedbackStyles.warning)
            }}
          >
            {feedback.message}
          </div>
        )}

        {reserved && secondsLeft > 0 && (
          <div
            style={{
              marginBottom: '20px',
              padding: '14px 16px',
              borderRadius: '14px',
              background: '#F1F5FF',
              border: '1px solid #D7E3FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}
          >
            <div>
              <div style={{ fontWeight: 800, color: '#142258' }}>Reserva activa</div>
              <div style={{ fontSize: '0.82rem', color: '#6B7A99' }}>
                Tienes este asiento bloqueado temporalmente.
              </div>
            </div>
            <div
              style={{
                minWidth: '92px',
                textAlign: 'center',
                padding: '8px 12px',
                borderRadius: '999px',
                background: '#3960FB',
                color: '#fff',
                fontWeight: 800,
                fontSize: '1rem'
              }}
            >
              {formatCountdown(secondsLeft)}
            </div>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '14px',
            marginBottom: '20px'
          }}
        >
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 700,
                color: '#142258',
                fontSize: '0.82rem'
              }}
            >
              Pasaporte
            </label>
            <input
              name="passportNumber"
              value={formData.passportNumber}
              onChange={handleChange}
              onBlur={handlePassportBlur}
              placeholder="Ej. P12345678"
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '1px solid #E2E8F0',
                borderRadius: '14px',
                fontSize: '0.92rem',
                outline: 'none'
              }}
            />
            {lookingUp && (
              <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#6B7A99' }}>
                Buscando pasajero...
              </div>
            )}
            {!lookingUp && passengerFound && (
              <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#0C8F52' }}>
                Pasajero encontrado.
              </div>
            )}
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 700,
                color: '#142258',
                fontSize: '0.82rem'
              }}
            >
              Email
            </label>
            <input
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="correo@ejemplo.com"
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '1px solid #E2E8F0',
                borderRadius: '14px',
                fontSize: '0.92rem',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 700,
                color: '#142258',
                fontSize: '0.82rem'
              }}
            >
              Nombre
            </label>
            <input
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="Nombre"
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '1px solid #E2E8F0',
                borderRadius: '14px',
                fontSize: '0.92rem',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 700,
                color: '#142258',
                fontSize: '0.82rem'
              }}
            >
              Apellido
            </label>
            <input
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Apellido"
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '1px solid #E2E8F0',
                borderRadius: '14px',
                fontSize: '0.92rem',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 700,
                color: '#142258',
                fontSize: '0.82rem'
              }}
            >
              Teléfono
            </label>
            <input
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Número de teléfono"
              style={{
                width: '100%',
                padding: '14px 16px',
                border: '1px solid #E2E8F0',
                borderRadius: '14px',
                fontSize: '0.92rem',
                outline: 'none'
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
            flexWrap: 'wrap'
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '12px 22px',
              borderRadius: '999px',
              border: '1px solid #D9E2F2',
              background: '#fff',
              color: '#142258',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleReserve}
            disabled={loading || reserved}
            style={{
              padding: '12px 22px',
              borderRadius: '999px',
              border: 'none',
              background: reserved ? '#BFD0FF' : '#F1F5FF',
              color: reserved ? '#6B7A99' : '#1A2EB5',
              fontWeight: 800,
              cursor: loading || reserved ? 'not-allowed' : 'pointer'
            }}
          >
            {loading && !reserved ? 'Procesando...' : reserved ? 'Reservado' : 'Reservar'}
          </button>

          <button
            type="button"
            onClick={handleBuy}
            disabled={loading}
            style={{
              padding: '12px 24px',
              borderRadius: '999px',
              border: 'none',
              background: loading
  ? '#BFD0FF'
  : 'linear-gradient(135deg, #3960FB 0%, #1A2EB5 100%)',
cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading && reserved ? 'Comprando...' : 'Comprar'}
          </button>
        </div>
      </div>
    </div>
  );
}