import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import SeatMap from './components/SeatMap';
import FlightSearch from './components/FlightSearch';
import Dashboard from './components/Dashboard';
import BookingForm from './components/BookingForm';
import LanguageSwitcher from './components/LanguageSwitcher';

const API_URL = 'http://localhost:3001/api/v1';

function App() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('search');
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [bookingResult, setBookingResult] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await axios.get(API_URL + '/dashboard/stats');
      setDashboardData(response.data);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
  };

  const handleFlightSelect = (flight) => {
    setSelectedFlight(flight);
    setSelectedSeat(null);
    setBookingResult(null);
    setActiveTab('seats');
  };

  const handleSeatSelect = (seat) => {
    setSelectedSeat(seat);
    setActiveTab('booking');
  };

  const handleBookingComplete = (result) => {
    setBookingResult(result);
    fetchDashboardData();
    setActiveTab('result');
  };

  return (
    <div className="min-h-screen bg-airline-light">
      <header className="bg-airline-blue text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">✈️ {t('title')}</h1>
            <p className="text-sm opacity-90">{t('subtitle')}</p>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <nav className="bg-white shadow-md">
        <div className="container mx-auto px-4">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('search')}
              className={'px-4 py-3 font-medium transition-colors ' + (activeTab === 'search' ? 'text-airline-blue border-b-2 border-airline-blue' : 'text-gray-600 hover:text-airline-blue')}
            >
              🔍 {t('flights')}
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={'px-4 py-3 font-medium transition-colors ' + (activeTab === 'dashboard' ? 'text-airline-blue border-b-2 border-airline-blue' : 'text-gray-600 hover:text-airline-blue')}
            >
              📊 {t('dashboard')}
            </button>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        {activeTab === 'search' && (
          <FlightSearch onFlightSelect={handleFlightSelect} />
        )}

        {activeTab === 'seats' && selectedFlight && (
          <div className="space-y-6">
            <button
              onClick={() => setActiveTab('search')}
              className="text-airline-blue hover:underline mb-4"
            >
              ← Volver a búsqueda
            </button>
            <div className="card">
              <h2 className="text-xl font-bold mb-2">
                {selectedFlight.origin} → {selectedFlight.destination}
              </h2>
              <p className="text-gray-600 mb-4">
                {selectedFlight.departure_date} | {selectedFlight.departure_time} | Puerta {selectedFlight.gate}
              </p>
              <SeatMap 
                flightId={selectedFlight.id} 
                onSeatSelect={handleSeatSelect}
              />
            </div>
          </div>
        )}

        {activeTab === 'booking' && selectedFlight && selectedSeat && (
          <BookingForm
            flight={selectedFlight}
            seat={selectedSeat}
            onComplete={handleBookingComplete}
            onCancel={() => setActiveTab('seats')}
          />
        )}

        {activeTab === 'result' && bookingResult && (
          <div className="card text-center">
            <div className={'text-4xl mb-4 ' + (bookingResult.success ? 'text-green-500' : 'text-red-500')}>
              {bookingResult.success ? '✅' : '❌'}
            </div>
            <h2 className="text-2xl font-bold mb-2">
              {bookingResult.success ? '¡Reserva Confirmada!' : 'Error en la Reserva'}
            </h2>
            <p className="text-gray-600 mb-6">{bookingResult.message}</p>
            
            {bookingResult.success && bookingResult.sale && (
              <div className="space-y-4">
                <div className="bg-gray-100 p-4 rounded-lg">
                  <p><strong>Ticket:</strong> {bookingResult.sale.ticket_number}</p>
                  <p><strong>Asiento:</strong> {bookingResult.sale.seat_number}</p>
                  <p><strong>Clase:</strong> {bookingResult.sale.class_type}</p>
                  <p><strong>Monto:</strong> ${bookingResult.sale.price_paid}</p>
                </div>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => {
                      window.open(API_URL + '/boarding-pass/pdf?ticket=' + bookingResult.sale.ticket_number, '_blank');
                    }}
                    className="btn-primary"
                  >
                    📄 {t('download')}
                  </button>
                  <button
                    onClick={() => {
                      window.open(API_URL + '/boarding-pass/wallet?ticket=' + bookingResult.sale.ticket_number, '_blank');
                    }}
                    className="btn-secondary"
                  >
                    📱 {t('wallet')}
                  </button>
                </div>
              </div>
            )}
            
            <button
              onClick={() => {
                setActiveTab('search');
                setSelectedFlight(null);
                setSelectedSeat(null);
                setBookingResult(null);
              }}
              className="btn-primary mt-6"
            >
              Nueva Reserva
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && dashboardData && (
          <Dashboard data={dashboardData} />
        )}
      </main>

      <footer className="bg-airline-dark text-white mt-12 py-4 text-center text-sm">
        <p>Aerolíneas Rafael Pabón - Sistema Distribuido con Relojes Vectoriales</p>
        <p className="opacity-75 text-xs mt-1">© 2026 - Todos los derechos reservados</p>
      </footer>
    </div>
  );
}

export default App;