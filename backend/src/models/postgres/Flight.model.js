const pool = require('../config/database/postgres');

const Flight = {
    findAll: async (filters = {}) => {
        let query = 'SELECT * FROM flights WHERE 1=1';
        const values = [];
        
        if (filters.origin) {
            query +=  AND origin_code = ${filters.origin}`;
        }
        if (filters.destination) {
            query +=  AND destination_code = ${filters.destination}`;
        }
        if (filters.date) {
            query +=  AND departure_date = ${filters.date}`;
        }
        
        const result = await pool.query(query);
        return result.rows;
    },
    
    findById: async (id) => {
        const result = await pool.query('SELECT * FROM flights WHERE id = ', [id]);
        return result.rows[0];
    },
    
    updateStatus: async (id, status) => {
        const result = await pool.query(
            'UPDATE flights SET status =  WHERE id =  RETURNING *',
            [status, id]
        );
        return result.rows[0];
    }
};

module.exports = Flight;
