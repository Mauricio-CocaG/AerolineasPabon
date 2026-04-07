import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api/v1';

function BookingForm({ flight, seat, onComplete, onCancel }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    passportNumber: '',
    email: '',
    phone: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const passengerResponse = await axios.post(API_URL + '/passenger', {
        passport_number: formData.passportNumber,
        first_name: formData.firstName,
        last_name: formData.lastName,
        email: formData.email,
        phone: formData.phone
      });
      
      const passengerId = passengerResponse.data.id;
      const price = seat.class_type === 'FIRST' ? flight.first_class_price : flight.economy_price;
      
      const reserveResponse = await axios.post(API_URL + '/seat/reserve', {
        flightId: flight.id,
        seatNumber: seat.seat_number,
        passengerId: passengerId,
        classType: seat.class_type
      });
      
      if (reserveResponse.data.success) {
        const sellResponse = await axios.post(API_URL + '/seat/sell', {
          flightId: flight.id,
          seatNumber: seat.seat_number,
          passengerId: passengerId,
          classType: seat.class_type,
          price: price
        });
        
        onComplete(sellResponse.data);
      } else {
        onComplete({ success: false, message: reserveResponse.data.error });
      }
      
    } catch (error) {
      console.error('Booking error:', error);
      onComplete({ success: false, message: error.response?.data?.error || 'Error al procesar la reserva' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card max-w-lg mx-auto">
      <h2 className="text-xl font-bold mb-4">Completar Reserva</h2>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-4">
        <p><strong>Vuelo:</strong> {flight.flight_number} - {flight.origin} → {flight.destination}</p>
        <p><strong>Asiento:</strong> {seat.seat_number}</p>
        <p><strong>Clase:</strong> {seat.class_type === 'FIRST' ? t('firstClass') : t('economy')}</p>
        <p><strong>Precio:</strong> ${seat.class_type === 'FIRST' ? flight.first_class_price : flight.economy_price}</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('name')}</label>
            <input
              type="text"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              required
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Nombre"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Apellido</label>
            <input
              type="text"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              required
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Apellido"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">{t('passport')}</label>
          <input
            type="text"
            name="passportNumber"
            value={formData.passportNumber}
            onChange={handleChange}
            required
            className="w-full border rounded-lg px-3 py-2"
            placeholder="Ej: ABC123456"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            className="w-full border rounded-lg px-3 py-2"
            placeholder="correo@ejemplo.com"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Teléfono</label>
          <input
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            className="w-full border rounded-lg px-3 py-2"
            placeholder="+123456789"
          />
        </div>
        
        <div className="flex gap-4">
          <button type="button" onClick={onCancel} className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="flex-1 btn-primary">
            {loading ? 'Procesando...' : '✅ ' + t('buy')}
          </button>
        </div>
      </form>
    </div>
  );
}

export default BookingForm;