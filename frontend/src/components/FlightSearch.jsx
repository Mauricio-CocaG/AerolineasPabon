import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api/v1';

function FlightSearch({ onFlightSelect }) {
  const { t } = useTranslation();
  const [airports, setAirports] = useState([]);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);

  useEffect(() => {
    fetchAirports();
  }, []);

  const fetchAirports = async () => {
    try {
      const response = await axios.get(API_URL + '/airports');
      setAirports(response.data.airports);
    } catch (error) {
      console.error('Error fetching airports:', error);
    }
  };

  const handleOriginChange = (value) => {
    setOrigin(value);
    if (value.length > 0) {
      const filtered = airports.filter(a => a.includes(value.toUpperCase()));
      setOriginSuggestions(filtered.slice(0, 5));
    } else {
      setOriginSuggestions([]);
    }
  };

  const handleDestinationChange = (value) => {
    setDestination(value);
    if (value.length > 0) {
      const filtered = airports.filter(a => a.includes(value.toUpperCase()));
      setDestSuggestions(filtered.slice(0, 5));
    } else {
      setDestSuggestions([]);
    }
  };

  const searchFlights = async () => {
    setLoading(true);
    try {
      const mockFlights = [
        { id: 1, flight_number: 'RP101', origin: origin || 'ATL', destination: destination || 'DFW', departure_date: date || '2026-04-15', departure_time: '17:33', gate: 'G26', status: 'SCHEDULED', economy_price: 250, first_class_price: 800 },
        { id: 2, flight_number: 'RP102', origin: origin || 'ATL', destination: destination || 'LON', departure_date: date || '2026-04-15', departure_time: '16:22', gate: 'G30', status: 'SCHEDULED', economy_price: 800, first_class_price: 2500 },
        { id: 3, flight_number: 'RP103', origin: origin || 'LON', destination: destination || 'PAR', departure_date: date || '2026-04-16', departure_time: '10:28', gate: 'G15', status: 'SCHEDULED', economy_price: 150, first_class_price: 500 },
      ];
      setFlights(mockFlights);
    } catch (error) {
      console.error('Error searching flights:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4">{t('search')} {t('flights')}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="relative">
          <label className="block text-sm font-medium mb-1">{t('origin')}</label>
          <input
            type="text"
            value={origin}
            onChange={(e) => handleOriginChange(e.target.value)}
            placeholder="Ej: ATL"
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-airline-blue"
          />
          {originSuggestions.length > 0 && (
            <div className="absolute z-10 w-full bg-white border rounded-lg mt-1 shadow-lg">
              {originSuggestions.map(sug => (
                <div key={sug} onClick={() => { setOrigin(sug); setOriginSuggestions([]); }} className="px-3 py-2 hover:bg-gray-100 cursor-pointer">
                  {sug}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="relative">
          <label className="block text-sm font-medium mb-1">{t('destination')}</label>
          <input
            type="text"
            value={destination}
            onChange={(e) => handleDestinationChange(e.target.value)}
            placeholder="Ej: DFW"
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-airline-blue"
          />
          {destSuggestions.length > 0 && (
            <div className="absolute z-10 w-full bg-white border rounded-lg mt-1 shadow-lg">
              {destSuggestions.map(sug => (
                <div key={sug} onClick={() => { setDestination(sug); setDestSuggestions([]); }} className="px-3 py-2 hover:bg-gray-100 cursor-pointer">
                  {sug}
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">{t('date')}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-airline-blue"
          />
        </div>
      </div>
      
      <button onClick={searchFlights} disabled={loading} className="btn-primary w-full">
        {loading ? 'Buscando...' : '🔍 ' + t('search')}
      </button>
      
      {flights.length > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="font-semibold">Vuelos Disponibles:</h3>
          {flights.map(flight => (
            <div key={flight.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-bold text-lg">{flight.flight_number}</p>
                  <p className="text-gray-600">{flight.origin} → {flight.destination}</p>
                  <p className="text-sm text-gray-500">{flight.departure_date} | {flight.departure_time} | Puerta {flight.gate}</p>
                </div>
                <div className="text-right">
                  <p className="text-airline-gold font-bold">Desde ${flight.economy_price}</p>
                  <button onClick={() => onFlightSelect(flight)} className="btn-primary mt-2 text-sm px-3 py-1">
                    Seleccionar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default FlightSearch;