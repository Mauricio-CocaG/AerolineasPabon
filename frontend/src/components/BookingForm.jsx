import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

export default function BookingForm({ apiUrl, flight, seat, onComplete, onCancel }) {
  const API_URL = apiUrl || 'http://localhost:3001/api/v1';
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [passengerFound, setPassengerFound] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', passportNumber: '', email: '', phone: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (e.target.name === 'passportNumber') setPassengerFound(false);
  };

  const handlePassportBlur = async () => {
    const passport = formData.passportNumber.trim();
    if (!passport) return;
    setLookingUp(true);
    try {
      const res = await axios.get(API_URL + '/passenger/search', { params: { passport } });
      const p = res.data;
      setFormData(prev => ({
        ...prev,
        firstName: p.first_name || prev.firstName,
        lastName:  p.last_name  || prev.lastName,
        email:     p.email      || prev.email,
        phone:     p.phone      || prev.phone,
      }));
      setPassengerFound(true);
    } catch { setPassengerFound(false); }
    finally  { setLookingUp(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const pRes = await axios.post(API_URL + '/passenger', {
        passport_number: formData.passportNumber,
        first_name: formData.firstName,
        last_name:  formData.lastName,
        email:      formData.email,
        phone:      formData.phone,
      });
      const passengerId = pRes.data.id;
      const price = seat.class_type === 'FIRST' ? flight.first_class_price : flight.economy_price;

      const rRes = await axios.post(API_URL + '/seat/reserve', {
        flightId: flight.id, seatNumber: seat.seat_number, passengerId, classType: seat.class_type,
      });

      if (rRes.data.success) {
        const sRes = await axios.post(API_URL + '/seat/sell', {
          flightId: flight.id, seatNumber: seat.seat_number, passengerId, classType: seat.class_type, price,
        });
        onComplete(sRes.data);
      } else {
        onComplete({ success: false, message: rRes.data.error });
      }
    } catch (err) {
      onComplete({ success: false, message: err.response?.data?.error || 'Error al procesar la reserva' });
    } finally {
      setLoading(false);
    }
  };

  const isFirst = seat.class_type === 'FIRST';
  const price   = isFirst ? flight.first_class_price : flight.economy_price;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>

      {/* Back */}
      <button onClick={onCancel} className="btn-back" style={{ marginBottom: '20px' }}>
        <i className="fa-solid fa-arrow-left" />
        {t('backToSeats')}
      </button>

      <div className="card fade-up">

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#142258', marginBottom: '4px' }}>
            {t('passengerData')}
          </h2>
          <p style={{ color: '#6B7A99', fontSize: '0.88rem' }}>{t('completeInfo')}</p>
        </div>

        {/* Flight summary */}
        <div style={{
          background: '#F7F9FF', border: '1.5px solid #EBEFFF',
          borderRadius: '14px', padding: '16px 20px',
          marginBottom: '24px', display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px',
        }}>
          <div>
            <p style={{ fontSize: '0.62rem', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>
              {t('flight')}
            </p>
            <p style={{ fontWeight: 800, color: '#142258', fontSize: '0.95rem' }}>{flight.flight_number}</p>
            <p style={{ fontSize: '0.78rem', color: '#3960FB', fontWeight: 600 }}>{flight.origin_code} → {flight.destination_code}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.62rem', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>
              {t('seat')}
            </p>
            <p style={{ fontWeight: 800, color: '#142258', fontSize: '1.1rem' }}>{seat.seat_number}</p>
          </div>
          <div>
            <p style={{ fontSize: '0.62rem', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>
              {t('class')}
            </p>
            <span className={isFirst ? 'tag tag-gold' : 'tag tag-blue'} style={{ fontWeight: 700 }}>
              {isFirst
                ? <><i className="fa-solid fa-star" style={{ fontSize: '0.6rem' }} />{t('firstClass')}</>
                : <><i className="fa-solid fa-plane" style={{ fontSize: '0.6rem' }} />{t('economy')}</>
              }
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.62rem', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '3px' }}>
              {t('total')}
            </p>
            <p style={{ fontWeight: 800, color: '#3960FB', fontSize: '1.2rem' }}>${parseFloat(price).toLocaleString()}</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Passport */}
            <div>
              <label className="input-label">
                <i className="fa-solid fa-passport" />
                {t('passport')}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  name="passportNumber"
                  value={formData.passportNumber}
                  onChange={handleChange}
                  onBlur={handlePassportBlur}
                  required
                  autoComplete="off"
                  placeholder="Ej: ABC123456"
                  className="input-field"
                />
                {lookingUp && (
                  <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.75rem', color: '#6B7A99', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '0.7rem' }} />
                    {t('lookingUp')}
                  </span>
                )}
              </div>
              {passengerFound && (
                <p style={{ marginTop: '5px', fontSize: '0.75rem', color: '#0CAF60', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <i className="fa-solid fa-circle-check" />
                  {t('passengerFound')}
                </p>
              )}
            </div>

            {/* Name */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label className="input-label">
                  <i className="fa-solid fa-user" />
                  {t('name')}
                </label>
                <input type="text" name="firstName" value={formData.firstName} onChange={handleChange}
                  required lang="und" placeholder={t('name')} className="input-field" />
              </div>
              <div>
                <label className="input-label">
                  <i className="fa-solid fa-user" />
                  {t('lastName')}
                </label>
                <input type="text" name="lastName" value={formData.lastName} onChange={handleChange}
                  required lang="und" placeholder={t('lastName')} className="input-field" />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="input-label">
                <i className="fa-solid fa-envelope" />
                {t('email')}
              </label>
              <input type="email" name="email" value={formData.email} onChange={handleChange}
                required placeholder="correo@ejemplo.com" className="input-field" />
            </div>

            {/* Phone */}
            <div>
              <label className="input-label">
                <i className="fa-solid fa-phone" />
                {t('phone')}
                <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400, color: '#B0BBD5', marginLeft: '4px' }}>({t('optional')})</span>
              </label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange}
                placeholder="+57 300 000 0000" className="input-field" />
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: '#EBEFFF' }} />

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={onCancel} className="btn-ghost" style={{ flex: 1 }}>
                <i className="fa-solid fa-xmark" />
                {t('cancel')}
              </button>
              <button type="submit" disabled={loading} className="btn-primary" style={{ flex: 2 }}>
                {loading
                  ? <><i className="fa-solid fa-circle-notch fa-spin" />{t('processing')}</>
                  : <><i className="fa-solid fa-circle-check" />{t('buy')} · ${parseFloat(price).toLocaleString()}</>
                }
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
