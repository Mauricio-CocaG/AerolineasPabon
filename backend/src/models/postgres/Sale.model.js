const pool = require('../config/database/postgres');
const { v4: uuidv4 } = require('uuid');

const Sale = {
    create: async (saleData) => {
        const { flight_id, passenger_id, seat_number, class_type, price_paid, vector_clock_snapshot } = saleData;
        const ticket_number = RP;
        
        const result = await pool.query(
            INSERT INTO sales (ticket_number, flight_id, passenger_id, seat_number, class_type, price_paid, vector_clock_snapshot, payment_status) 
             VALUES (, , , , , , , ) RETURNING *,
            [ticket_number, flight_id, passenger_id, seat_number, class_type, price_paid, JSON.stringify(vector_clock_snapshot), 'COMPLETED']
        );
        return result.rows[0];
    },
    
    findByFlightAndSeat: async (flightId, seatNumber) => {
        const result = await pool.query(
            'SELECT * FROM sales WHERE flight_id =  AND seat_number = ',
            [flightId, seatNumber]
        );
        return result.rows[0];
    },
    
    getDashboardStats: async () => {
        const result = await pool.query(
            SELECT 
                COUNT(*) as total_sales,
                SUM(price_paid) as total_revenue,
                SUM(CASE WHEN class_type = 'FIRST' THEN price_paid ELSE 0 END) as first_class_revenue,
                SUM(CASE WHEN class_type = 'ECONOMY' THEN price_paid ELSE 0 END) as economy_revenue
            FROM sales
        );
        return result.rows[0];
    }
};

module.exports = Sale;
