import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { gsap } from 'gsap';

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

  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    passportNumber: '',
    email: '',
    phone: ''
  });

  const stripRef = useRef(null);
  const cardRef = useRef(null);
  const gridRef = useRef(null);

  useEffect(() => {
    if (stripRef.current) gsap.fromTo(stripRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out', delay: 0.05 });
    if (cardRef.current)  gsap.fromTo(cardRef.current,  { opacity: 0, y: 24, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.2)', delay: 0.15 });
    if (gridRef.current)  gsap.fromTo(gridRef.current.children, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.35, stagger: 0.06, ease: 'power3.out', delay: 0.3 });
  }, []);

  const isFirst = seat.class_type === 'FIRST';
  const price = isFirst ? flight.first_class_price : flight.economy_price;

  const formattedPrice = useMemo(() => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(price) || 0);
  }, [price]);

  useEffect(() => {
    if (!reservationExpiresAt) {
      setSecondsLeft(0);
      return;
    }
    const updateCountdown = () => {
      const diff = Math.max(0, Math.floor((new Date(reservationExpiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
      if (diff <= 0) {
        setReserved(false);
        setReservationExpiresAt(null);
        setFeedback({ type: 'warning', message: t('reservationExpired') });
      }
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [reservationExpiresAt, t]);

  const formatCountdown = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
      const res = await axios.get(API_URL + '/passenger/search', { params: { passport } });
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
      setFeedback({ type: 'success', message: t('passengerFoundAuto') });
    } catch {
      setPassengerFound(false);
      setPassengerId(null);
    } finally {
      setLookingUp(false);
    }
  };

  const ensurePassenger = async () => {
    if (!formData.passportNumber.trim() || !formData.firstName.trim() || !formData.lastName.trim()) {
      throw new Error(t('completeFormRequired'));
    }
    if (passengerId) return passengerId;
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
        setFeedback({ type: 'success', message: rRes.data.message || t('bookingActive') });
      } else {
        setReserved(false);
        setReservationExpiresAt(null);
        setFeedback({ type: 'error', message: rRes.data.error || t('bookingError') });
      }
    } catch (err) {
      setReserved(false);
      setReservationExpiresAt(null);
      setFeedback({ type: 'error', message: err.response?.data?.error || err.message || t('bookingError') });
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
      if (onComplete) onComplete(sRes.data);
    } catch (err) {
      const message = err.response?.data?.error || err.response?.data?.message || err.message || t('bookingError');
      setFeedback({ type: 'error', message });
      if (onComplete) onComplete({ success: false, message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <button className="btn-back2" onClick={onCancel}>
        <i className="fa-solid fa-arrow-left" />
        {t('backToSeats')}
      </button>

      {/* ── Flight/seat strip ── */}
      <div className="booking-strip" ref={stripRef}>
        <div className="bs-item">
          <div className="bs-lbl">{t('flight')}</div>
          <div className="bs-val mono">{flight.flight_number}</div>
          <div style={{ fontSize: '.72rem', color: '#6B8FFF', fontWeight: 600, marginTop: '2px' }}>
            {flight.origin_code} → {flight.destination_code}
          </div>
        </div>
        <div className="bs-div" />
        <div className="bs-item">
          <div className="bs-lbl">{t('seat')}</div>
          <div className="bs-val mono blue">{seat.seat_number}</div>
          <div style={{ marginTop: '4px' }}>
            <span className="bs-badge">
              {isFirst ? t('firstClass') : t('economy')}
            </span>
          </div>
        </div>
        <div className="bs-div" />
        <div className="bs-item">
          <div className="bs-lbl">{t('date')}</div>
          <div className="bs-val" style={{ fontSize: '.82rem' }}>{flight.departure_date?.substring(0, 10)}</div>
          <div style={{ fontSize: '.72rem', color: '#6B8FFF', fontWeight: 600, marginTop: '2px' }}>
            {String(flight.departure_time || '').substring(0, 5)}
          </div>
        </div>
        <div className="bs-div" />
        <div className="bs-item">
          <div className="bs-lbl">{t('price')}</div>
          <div className="bs-val mono blue">{formattedPrice}</div>
        </div>
      </div>

      {/* ── Form card ── */}
      <div className="form-card" ref={cardRef}>
        <div className="form-header">
          <div className="form-eyebrow">
            <i className="fa-solid fa-user" style={{ fontSize: '.6rem' }} />
            {t('passengerData')}
          </div>
          <div className="form-title">{t('passengerData')}</div>
          <div className="form-sub">{t('completeInfo')}</div>
        </div>

        <div className="form-body">

          {feedback.message && (
            <div className={`feedback-box feedback-${feedback.type}`}>
              <i className={`fa-solid ${feedback.type === 'success' ? 'fa-circle-check' : feedback.type === 'error' ? 'fa-circle-xmark' : 'fa-triangle-exclamation'}`} />
              {feedback.message}
            </div>
          )}

          {reserved && secondsLeft > 0 && (
            <div className="countdown-box">
              <div>
                <div style={{ fontWeight: 800, color: 'var(--text)', marginBottom: '2px' }}>{t('bookingActive')}</div>
                <div style={{ fontSize: '.82rem', color: 'var(--t2)' }}>{t('seatLockedTemp')}</div>
              </div>
              <div className="countdown-timer">
                {formatCountdown(secondsLeft)}
              </div>
            </div>
          )}

          <div className="form-grid" ref={gridRef}>
            <div className="form-row">
              {/* Passport */}
              <div>
                <div className="f-label">
                  <i className="fa-solid fa-passport" />
                  {t('passport')}
                </div>
                <input
                  name="passportNumber"
                  value={formData.passportNumber}
                  onChange={handleChange}
                  onBlur={handlePassportBlur}
                  placeholder={t('passportPlaceholder')}
                  className="f-input"
                />
                {lookingUp && (
                  <div style={{ marginTop: '5px', fontSize: '.72rem', color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '.65rem' }} />
                    {t('lookingUpPassenger')}
                  </div>
                )}
                {!lookingUp && passengerFound && (
                  <div className="f-found">
                    <i className="fa-solid fa-circle-check" style={{ fontSize: '.65rem' }} />
                    {t('passengerFoundShort')}
                  </div>
                )}
              </div>

              {/* Email */}
              <div>
                <div className="f-label">
                  <i className="fa-solid fa-envelope" />
                  {t('email')}
                </div>
                <input
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="correo@ejemplo.com"
                  className="f-input"
                />
              </div>
            </div>

            <div className="form-row">
              {/* First name */}
              <div>
                <div className="f-label">
                  <i className="fa-solid fa-user" />
                  {t('name')}
                </div>
                <input
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder={t('name')}
                  className="f-input"
                />
              </div>

              {/* Last name */}
              <div>
                <div className="f-label">
                  <i className="fa-solid fa-user" />
                  {t('lastName')}
                </div>
                <input
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder={t('lastName')}
                  className="f-input"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <div className="f-label">
                <i className="fa-solid fa-phone" />
                {t('phone')}
              </div>
              <input
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder={t('phone')}
                className="f-input"
              />
            </div>

            <div className="form-divider" />

            {/* Actions */}
            <div className="form-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={onCancel}
                disabled={loading}
              >
                <i className="fa-solid fa-xmark" style={{ fontSize: '.75rem' }} />
                {t('cancel')}
              </button>

              <button
                type="button"
                className="btn-reserve"
                onClick={handleReserve}
                disabled={loading || reserved}
              >
                <i className="fa-solid fa-clock" style={{ fontSize: '.75rem' }} />
                {loading && !reserved ? t('processing') + '...' : reserved ? t('reserved2') : t('reserve')}
              </button>

              <button
                type="button"
                className="btn-buy"
                onClick={handleBuy}
                disabled={loading}
              >
                <i className="fa-solid fa-bag-shopping" style={{ fontSize: '.75rem' }} />
                {loading && reserved ? t('buying') : t('buy')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
