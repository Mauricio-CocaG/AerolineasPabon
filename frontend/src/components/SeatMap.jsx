import React, { useState, useEffect } from 'react';

function SeatMap({ flightId, onSeatSelect }) {
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const generateMockSeats = () => {
      const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
      const seatsList = [];
      for (let i = 1; i <= 10; i++) {
        for (const row of rows) {
          const seatNumber = i + row;
          const random = Math.random();
          let status = 'AVAILABLE';
          if (random < 0.7) status = 'AVAILABLE';
          else if (random < 0.8) status = 'RESERVED';
          else if (random < 0.95) status = 'SOLD';
          else status = 'REFUNDED';
          
          seatsList.push({
            seat_number: seatNumber,
            status: status,
            class_type: i <= 2 ? 'FIRST' : 'ECONOMY'
          });
        }
      }
      setSeats(seatsList);
      setLoading(false);
    };
    
    generateMockSeats();
  }, [flightId]);

  const getSeatColor = (status) => {
    switch(status) {
      case 'AVAILABLE': return 'seat-available';
      case 'RESERVED': return 'seat-reserved';
      case 'SOLD': return 'seat-sold';
      case 'REFUNDED': return 'seat-refunded';
      default: return 'seat-available';
    }
  };

  const getSeatLabel = (status) => {
    switch(status) {
      case 'AVAILABLE': return '💰 Disponible';
      case 'RESERVED': return '⏳ Reservado';
      case 'SOLD': return '❌ Vendido';
      case 'REFUNDED': return '🔄 En devolución';
      default: return 'Disponible';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Cargando mapa de asientos...</div>;
  }

  const firstClassSeats = seats.filter(s => s.class_type === 'FIRST');
  const economySeats = seats.filter(s => s.class_type === 'ECONOMY');

  return (
    <div>
      <div className="mb-4 flex gap-4 justify-center">
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-500 rounded"></div><span>Disponible</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-yellow-500 rounded"></div><span>Reservado</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-500 rounded"></div><span>Vendido</span></div>
        <div className="flex items-center gap-2"><div className="w-4 h-4 bg-red-500 rounded"></div><span>En devolución</span></div>
      </div>
      
      <div className="mb-8">
        <h3 className="text-lg font-bold text-airline-gold mb-2">✨ Primera Clase</h3>
        <div className="grid grid-cols-6 gap-2">
          {firstClassSeats.map(seat => (
            <button
              key={seat.seat_number}
              onClick={() => seat.status === 'AVAILABLE' && onSeatSelect(seat)}
              disabled={seat.status !== 'AVAILABLE'}
              className={getSeatColor(seat.status) + ' text-sm font-medium'}
              title={getSeatLabel(seat.status)}
            >
              {seat.seat_number}
            </button>
          ))}
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-bold text-airline-blue mb-2">✈️ Clase Turista</h3>
        <div className="grid grid-cols-6 gap-2">
          {economySeats.map(seat => (
            <button
              key={seat.seat_number}
              onClick={() => seat.status === 'AVAILABLE' && onSeatSelect(seat)}
              disabled={seat.status !== 'AVAILABLE'}
              className={getSeatColor(seat.status) + ' text-sm font-medium'}
              title={getSeatLabel(seat.status)}
            >
              {seat.seat_number}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SeatMap;