const pool = require('../config/database/postgres');

const Sale = {
    create: async (saleData) => {
        const {
            flight_id,
            passenger_id,
            seat_number,
            class_type,
            price_paid,
            vector_clock_snapshot
        } = saleData;

        const ticket_number = 'RP' + Date.now() + Math.floor(Math.random() * 1000);

        const result = await pool.query(
            `INSERT INTO sales (
                ticket_number,
                flight_id,
                passenger_id,
                seat_number,
                class_type,
                price_paid,
                vector_clock_snapshot,
                payment_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *`,
            [
                ticket_number,
                flight_id,
                passenger_id,
                seat_number,
                class_type,
                price_paid,
                vector_clock_snapshot ? JSON.stringify(vector_clock_snapshot) : null,
                'COMPLETED'
            ]
        );

        return result.rows[0];
    },

    findByFlightAndSeat: async (flightId, seatNumber) => {
        const result = await pool.query(
            'SELECT * FROM sales WHERE flight_id = $1 AND seat_number = $2',
            [flightId, seatNumber]
        );

        return result.rows[0];
    },

    getDashboardStats: async () => {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_sales,
                COALESCE(SUM(price_paid), 0) as total_revenue,
                COALESCE(SUM(CASE WHEN class_type = 'FIRST' THEN price_paid ELSE 0 END), 0) as first_class_revenue,
                COALESCE(SUM(CASE WHEN class_type = 'ECONOMY' THEN price_paid ELSE 0 END), 0) as economy_revenue
            FROM sales
            WHERE payment_status = 'COMPLETED'
        `);

        return result.rows[0];
    }
};

module.exports = Sale;