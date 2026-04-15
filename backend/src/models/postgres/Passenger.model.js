const pool = require('../config/database/postgres');

const Passenger = {
    create: async (passengerData) => {
        const { passport_number, first_name, last_name, email, phone, nationality } = passengerData;
        const result = await pool.query(
            INSERT INTO passengers (passport_number, first_name, last_name, email, phone, nationality) 
             VALUES (, , , , , ) RETURNING *,
            [passport_number, first_name, last_name, email, phone, nationality]
        );
        return result.rows[0];
    },
    
    findByPassport: async (passportNumber) => {
        const result = await pool.query(
            'SELECT * FROM passengers WHERE passport_number = ',
            [passportNumber]
        );
        return result.rows[0];
    },
    
    findById: async (id) => {
        const result = await pool.query('SELECT * FROM passengers WHERE id = ', [id]);
        return result.rows[0];
    }
};

module.exports = Passenger;
