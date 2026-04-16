const fs = require('fs');
const pool = require('../src/config/database/postgres');

async function resetAndLoad() {
    const csvPath = "02 - Practica 3 Dataset Flights.csv";
    
    console.log('\n========================================');
    console.log('🚀 RESET Y CARGA COMPLETA');
    console.log('========================================\n');
    
    // 1. Limpiar todas las tablas
    console.log('🗑️  Limpiando tablas...');
    await pool.query('DROP TABLE IF EXISTS sync_log CASCADE');
    await pool.query('DROP TABLE IF EXISTS sales CASCADE');
    await pool.query('DROP TABLE IF EXISTS flights CASCADE');
    await pool.query('DROP TABLE IF EXISTS passengers CASCADE');
    await pool.query('DROP TABLE IF EXISTS aircrafts CASCADE');
    await pool.query('DROP TABLE IF EXISTS airports CASCADE');
    console.log('✅ Tablas eliminadas');
    
    // 2. Crear tablas desde cero
    console.log('📦 Creando tablas...');
    
    await pool.query(`
        CREATE TABLE airports (
            id SERIAL PRIMARY KEY,
            code VARCHAR(3) UNIQUE NOT NULL,
            name VARCHAR(100),
            city VARCHAR(100),
            country VARCHAR(100)
        )
    `);
    
    await pool.query(`
        CREATE TABLE aircrafts (
            id SERIAL PRIMARY KEY,
            model VARCHAR(100) NOT NULL,
            first_class_seats INT NOT NULL,
            economy_seats INT NOT NULL,
            range_km INT
        )
    `);
    
    await pool.query(`
        CREATE TABLE flights (
            id SERIAL PRIMARY KEY,
            flight_number VARCHAR(20) UNIQUE,
            origin_code VARCHAR(3),
            destination_code VARCHAR(3),
            aircraft_id INT,
            departure_date DATE NOT NULL,
            departure_time TIME NOT NULL,
            gate VARCHAR(5),
            status VARCHAR(20) DEFAULT 'SCHEDULED',
            economy_price DECIMAL(10,2),
            first_class_price DECIMAL(10,2),
            flight_duration_hours DECIMAL(5,2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    await pool.query(`
        CREATE TABLE passengers (
            id SERIAL PRIMARY KEY,
            passport_number VARCHAR(20) UNIQUE NOT NULL,
            first_name VARCHAR(100),
            last_name VARCHAR(100),
            email VARCHAR(200),
            phone VARCHAR(20)
        )
    `);
    
    await pool.query(`
    CREATE TABLE sales (
        id SERIAL PRIMARY KEY,
        ticket_number VARCHAR(20) UNIQUE NOT NULL,
        booking_reference VARCHAR(50),
        flight_id INT REFERENCES flights(id),
        passenger_id INT REFERENCES passengers(id),
        seat_number VARCHAR(4),
        class_type VARCHAR(20),
        price_paid DECIMAL(10,2),
        vector_clock_snapshot JSONB,
        payment_status VARCHAR(20) DEFAULT 'PENDING',
        sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`);
    
    await pool.query(`
        CREATE TABLE sync_log (
            id SERIAL PRIMARY KEY,
            node_id INT,
            operation VARCHAR(20),
            flight_id INT,
            seat_number VARCHAR(4),
            sync_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    console.log('✅ Tablas creadas');
    
    // 3. Cargar aeropuertos
    const airports = ['ATL', 'PEK', 'DXB', 'TYO', 'LON', 'LAX', 'PAR', 'FRA', 'IST', 'SIN', 'MAD', 'AMS', 'DFW', 'CAN', 'SAO'];
    console.log('✈️  Cargando aeropuertos...');
    for (const code of airports) {
        await pool.query('INSERT INTO airports (code, name) VALUES ($1, $2)', [code, code]);
    }
    console.log(`✅ ${airports.length} aeropuertos cargados`);
    
    // 4. Crear aircrafts del 1 al 36
    console.log('🛩️  Cargando aviones...');
    for (let i = 1; i <= 36; i++) {
        await pool.query(
            'INSERT INTO aircrafts (id, model, first_class_seats, economy_seats) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
            [i, `Aircraft Model ${i}`, 10, 200 + i]
        );
    }
    console.log('✅ 36 aviones cargados');
    
    // 5. Cargar CSV
    console.log('📖 Leyendo CSV...');
    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n');
    console.log(`📊 Total líneas: ${lines.length}`);
    
    let inserted = 0;
    let errors = 0;
    let counter = 1;
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',');
        if (parts.length < 7) {
            errors++;
            continue;
        }
        
        const flight_date = parts[0].trim();
        const flight_time = parts[1].trim();
        const origin = parts[2].trim();
        const destination = parts[3].trim();
        const aircraft_id = parseInt(parts[4].trim());
        const status = parts[5].trim();
        const gate = parts[6].trim();
        
        let formattedDate = null;
        if (flight_date) {
            const dateParts = flight_date.split('/');
            if (dateParts.length === 3) {
                const year = 2000 + parseInt(dateParts[2]);
                const month = dateParts[0].padStart(2, '0');
                const day = dateParts[1].padStart(2, '0');
                formattedDate = `${year}-${month}-${day}`;
            }
        }
        
        if (formattedDate && origin && destination) {
            try {
                const flightNumber = `RP${String(counter).padStart(6, '0')}`;
                
                await pool.query(
                    `INSERT INTO flights (flight_number, origin_code, destination_code, aircraft_id, 
                      departure_date, departure_time, gate, status)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [flightNumber, origin, destination, aircraft_id, formattedDate, flight_time, gate, status]
                );
                inserted++;
                counter++;
                
                if (inserted % 5000 === 0) {
                    console.log(`   Insertados ${inserted} vuelos...`);
                }
            } catch (err) {
                errors++;
            }
        } else {
            errors++;
        }
    }
    
    console.log(`\n✅ Insertados: ${inserted} vuelos`);
    console.log(`⚠️  Errores: ${errors}`);
    
    // 6. Verificar resultado final
    const result = await pool.query('SELECT COUNT(*) FROM flights');
    const aircraftResult = await pool.query('SELECT COUNT(*) FROM aircrafts');
    const airportResult = await pool.query('SELECT COUNT(*) FROM airports');
    
    console.log('\n========================================');
    console.log('📊 RESUMEN FINAL');
    console.log('========================================');
    console.log(`✈️  Aeropuertos: ${airportResult.rows[0].count}`);
    console.log(`🛩️  Aviones: ${aircraftResult.rows[0].count}`);
    console.log(`📋  Vuelos: ${result.rows[0].count}`);
    console.log('========================================');
    
    // Mostrar ejemplos
    const samples = await pool.query('SELECT flight_number, origin_code, destination_code, departure_date FROM flights LIMIT 5');
    console.log('\n📌 Ejemplos de vuelos cargados:');
    samples.rows.forEach(row => {
        console.log(`   ${row.flight_number}: ${row.origin_code} → ${row.destination_code} (${row.departure_date})`);
    });
}

resetAndLoad().then(() => {
    console.log('\n✅ CARGA COMPLETADA EXITOSAMENTE!');
    process.exit(0);
}).catch(err => {
    console.error('❌ Error fatal:', err);
    process.exit(1);
});