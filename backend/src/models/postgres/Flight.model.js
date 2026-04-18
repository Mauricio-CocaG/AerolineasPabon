const pool = require('../config/database/postgres');

// 1. Definimos los estados oficiales de la práctica 
const FLIGHT_STATUSES = [
    'SCHEDULED', 
    'BOARDING',  // Nuevo [cite: 51]
    'DEPARTED', 
    'IN_FLIGHT', // Nuevo [cite: 53]
    'LANDED',    // Nuevo [cite: 54]
    'ARRIVED',   // Nuevo [cite: 55]
    'DELAYED', 
    'CANCELLED'
];

const Flight = {
    findAll: async (filters = {}) => {
        let query = 'SELECT * FROM flights WHERE 1=1';
        const values = [];
        let index = 1;
        
        // Corregido: Uso de parámetros ($1, $2) para evitar inyecciones SQL
        if (filters.origin) {
            query += ` AND origin_code = $${index++}`;
            values.push(filters.origin);
        }
        if (filters.destination) {
            query += ` AND destination_code = $${index++}`;
            values.push(filters.destination);
        }
        if (filters.date) {
            query += ` AND departure_date = $${index++}`;
            values.push(filters.date);
        }
        
        const result = await pool.query(query, values);
        return result.rows;
    },
    
    findById: async (id) => {
        // Corregido: Agregado el marcador $1
        const result = await pool.query('SELECT * FROM flights WHERE id = $1', [id]);
        return result.rows[0];
    },
    
    updateStatus: async (id, status) => {
        // 2. TAREA: Validación de los nuevos estados
        if (!FLIGHT_STATUSES.includes(status)) {
            throw new Error(`Estado no válido: ${status}. Los estados permitidos son: ${FLIGHT_STATUSES.join(', ')}`);
        }

        const result = await pool.query(
            'UPDATE flights SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );
        return result.rows[0];
    }
};

module.exports = Flight;