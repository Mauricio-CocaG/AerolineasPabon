-- ============================================
-- SCRIPT DE INICIALIZACIÓN DE BASE DE DATOS
-- Aerolíneas Rafael Pabón
-- Se ejecuta automáticamente al iniciar PostgreSQL
-- ============================================

-- Crear tabla de aeropuertos
CREATE TABLE IF NOT EXISTS airports (
    id SERIAL PRIMARY KEY,
    code VARCHAR(3) UNIQUE NOT NULL,
    name VARCHAR(100),
    city VARCHAR(100),
    country VARCHAR(100),
    timezone VARCHAR(50)
);

-- Crear tabla de flota de aviones
CREATE TABLE IF NOT EXISTS aircrafts (
    id SERIAL PRIMARY KEY,
    model VARCHAR(100) NOT NULL,
    first_class_seats INT NOT NULL,
    economy_seats INT NOT NULL,
    range_km INT,
    cruise_speed_kmh INT DEFAULT 900
);

-- Crear tabla de vuelos
CREATE TABLE IF NOT EXISTS flights (
    id SERIAL PRIMARY KEY,
    flight_number VARCHAR(20) UNIQUE,
    origin_code VARCHAR(3) REFERENCES airports(code),
    destination_code VARCHAR(3) REFERENCES airports(code),
    aircraft_id INT REFERENCES aircrafts(id),
    departure_date DATE NOT NULL,
    departure_time TIME NOT NULL,
    gate VARCHAR(5),
    status VARCHAR(20) DEFAULT 'SCHEDULED',
    first_class_price DECIMAL(10,2),
    economy_price DECIMAL(10,2),
    flight_duration_hours DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de pasajeros
CREATE TABLE IF NOT EXISTS passengers (
    id SERIAL PRIMARY KEY,
    passport_number VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(200),
    phone VARCHAR(20),
    nationality VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de ventas (CON la columna vector_clock_snapshot)
CREATE TABLE IF NOT EXISTS sales (
    id SERIAL PRIMARY KEY,
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    flight_id INT REFERENCES flights(id),
    passenger_id INT REFERENCES passengers(id),
    seat_number VARCHAR(4),
    class_type VARCHAR(20),
    price_paid DECIMAL(10,2),
    payment_status VARCHAR(20) DEFAULT 'PENDING',
    booking_reference VARCHAR(20),
    vector_clock_snapshot JSONB,
    sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de bitácora de sincronización
CREATE TABLE IF NOT EXISTS sync_log (
    id SERIAL PRIMARY KEY,
    node_id INT,
    operation VARCHAR(20),
    flight_id INT,
    seat_number VARCHAR(4),
    local_vector_clock JSONB,
    remote_vector_clock JSONB,
    resolution VARCHAR(20),
    sync_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INSERTAR DATOS DE EJEMPLO
-- ============================================

-- Aeropuertos
INSERT INTO airports (code, name, city, country) VALUES
('ATL', 'Hartsfield-Jackson Atlanta', 'Atlanta', 'USA'),
('DFW', 'Dallas/Fort Worth', 'Dallas', 'USA'),
('LON', 'London Heathrow', 'London', 'UK'),
('PEK', 'Beijing Capital', 'Beijing', 'China'),
('DXB', 'Dubai International', 'Dubai', 'UAE'),
('TYO', 'Tokyo Haneda', 'Tokyo', 'Japan'),
('PAR', 'Charles de Gaulle', 'Paris', 'France'),
('LAX', 'Los Angeles International', 'Los Angeles', 'USA'),
('FRA', 'Frankfurt Airport', 'Frankfurt', 'Germany'),
('IST', 'Istanbul Airport', 'Istanbul', 'Turkey'),
('SIN', 'Singapore Changi', 'Singapore', 'Singapore'),
('MAD', 'Madrid-Barajas', 'Madrid', 'Spain'),
('AMS', 'Amsterdam Schiphol', 'Amsterdam', 'Netherlands'),
('CAN', 'Guangzhou Baiyun', 'Guangzhou', 'China'),
('SAO', 'São Paulo Guarulhos', 'São Paulo', 'Brazil')
ON CONFLICT (code) DO NOTHING;

-- Aviones (IDs 1-36 para cubrir todos los del CSV)
INSERT INTO aircrafts (id, model, first_class_seats, economy_seats, range_km) VALUES
(1, 'Airbus A319', 6, 140, 6800),
(2, 'Airbus A320', 6, 180, 6500),
(3, 'Boeing 737-700', 6, 149, 6200),
(4, 'Boeing 737-800', 8, 162, 5400),
(5, 'Airbus A321', 8, 200, 7400),
(6, 'Boeing 757-200', 8, 200, 7200),
(7, 'Airbus A330-300', 12, 277, 11750),
(8, 'Boeing 767-300ER', 8, 218, 11000),
(9, 'Airbus A340-300', 12, 250, 13500),
(10, 'Boeing 777-200ER', 8, 264, 14300),
(11, 'Airbus A350-900', 12, 250, 15000),
(12, 'Boeing 787-9', 8, 290, 14140),
(13, 'Airbus A380-800', 10, 439, 15200),
(14, 'Boeing 747-400', 10, 410, 13500),
(15, 'Embraer E190', 4, 96, 4500),
(16, 'Bombardier CRJ900', 4, 76, 2800),
(17, 'Airbus A220-300', 5, 130, 6300),
(18, 'Boeing 737-900ER', 8, 180, 5900),
(19, 'Airbus A330-200', 12, 260, 13400),
(20, 'Boeing 777-300ER', 10, 300, 13650),
(21, 'Airbus A320neo', 6, 180, 6500),
(22, 'Boeing 737 MAX 8', 8, 178, 6500),
(23, 'Airbus A321neo', 8, 200, 7400),
(24, 'Boeing 787-8', 8, 220, 13500),
(25, 'Airbus A350-1000', 14, 350, 16100),
(26, 'Boeing 777X', 12, 350, 16000),
(27, 'Airbus A380plus', 10, 450, 15500),
(28, 'Boeing 747-8', 10, 420, 14000),
(29, 'Boeing 787-8 Dreamliner', 8, 220, 13500),
(30, 'Airbus A330-900neo', 12, 290, 13300),
(31, 'Boeing 737 MAX 9', 8, 193, 6700),
(32, 'Airbus A380-800', 10, 439, 15200),
(33, 'Boeing 777-300ER', 10, 300, 13650),
(34, 'Airbus A350-900', 12, 250, 15000),
(35, 'Boeing 787-9 Dreamliner', 8, 220, 14140),
(36, 'Airbus A330-300', 12, 277, 11750)
ON CONFLICT (id) DO NOTHING;

-- Vuelos de ejemplo
INSERT INTO flights (flight_number, origin_code, destination_code, departure_date, departure_time, gate, status, economy_price, first_class_price) VALUES
('RP101', 'ATL', 'DFW', CURRENT_DATE + INTERVAL '1 day', '17:33', 'G26', 'SCHEDULED', 250, 800),
('RP102', 'ATL', 'LON', CURRENT_DATE + INTERVAL '1 day', '16:22', 'G30', 'SCHEDULED', 800, 2500),
('RP103', 'LON', 'PAR', CURRENT_DATE + INTERVAL '2 days', '10:28', 'G15', 'SCHEDULED', 150, 500),
('RP104', 'DXB', 'TYO', CURRENT_DATE + INTERVAL '3 days', '17:59', 'G23', 'SCHEDULED', 900, 2800),
('RP105', 'PEK', 'LON', CURRENT_DATE + INTERVAL '4 days', '14:19', 'G23', 'SCHEDULED', 650, 2000)
ON CONFLICT (flight_number) DO NOTHING;

-- Pasajeros de ejemplo
INSERT INTO passengers (passport_number, first_name, last_name, email, phone) VALUES
('ABC123456', 'Juan', 'Perez', 'juan.perez@email.com', '+1234567890'),
('DEF789012', 'Maria', 'Gomez', 'maria.gomez@email.com', '+0987654321')
ON CONFLICT (passport_number) DO NOTHING;

-- Mostrar mensaje de éxito
DO $$
BEGIN
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'Base de datos inicializada correctamente';
    RAISE NOTICE 'Tablas creadas: airports, aircrafts, flights, passengers, sales, sync_log';
    RAISE NOTICE '==========================================';
END $$;