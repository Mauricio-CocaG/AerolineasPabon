require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const os = require('os');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');

const SyncService = require('./services/sync.service');
const BookingService = require('./services/booking.service');
const DijkstraService = require('./services/dijkstra.service');
const DashboardController = require('./controllers/dashboard.controller');
const PDFGeneratorService = require('./services/pdf-generator.service');
const ItineraryService = require('./services/itinerary.service');

const { connectMongoDB } = require('./config/database/mongodb');
const { connectRedis } = require('./config/database/redis');
const pool = require('./config/database/postgres');

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ID = parseInt(process.env.NODE_ID) || 1;
const NODE_NAME = process.env.NODE_NAME || 'BOGOTA';

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Servicios globales
let syncService = null;
let bookingService = null;
let dashboardController = null;
let itineraryService = null;

const dijkstraService = new DijkstraService();
const pdfGenerator = new PDFGeneratorService();

// ======================================================
// HELPERS
// ======================================================

function getPublicBaseUrl(req) {
    if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');

    const nets = os.networkInterfaces();
    const candidates = [];

    for (const ifaces of Object.values(nets)) {
        for (const net of ifaces) {
            if (net.family !== 'IPv4' || net.internal) continue;
            if (net.address.startsWith('192.168.')) {
                candidates.unshift(net.address);
                break;
            }
            if (net.address.startsWith('10.')) {
                candidates.push(net.address);
            }
        }
    }

    if (candidates.length > 0) return `http://${candidates[0]}:${PORT}`;

    const proto = req.headers['x-forwarded-proto'] || 'http';
    return `${proto}://${req.get('host')}`;
}

function buildGoogleWalletUrl(data) {
    let svcEmail;
    let privateKey;
    const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;

    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE) {
        try {
            const kp = path.resolve(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE);
            const k = JSON.parse(fs.readFileSync(kp, 'utf8'));
            svcEmail = k.client_email;
            privateKey = k.private_key;
        } catch { }
    }

    if (!svcEmail) svcEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    if (!privateKey) {
        privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    }

    if (!issuerId || !svcEmail || !privateKey || !privateKey.includes('BEGIN')) return null;

    try {
        const fnMatch = /^([A-Z]{2,3})\s*(\d+)$/i.exec(String(data.flightNumber || '').trim());
        const carrierCode = fnMatch ? fnMatch[1].toUpperCase() : 'AP';
        const flightNum = fnMatch ? fnMatch[2] : String(data.flightNumber || '');

        let depDate = '';
        try {
            const raw = data.departureDate;
            const iso = raw instanceof Date ? raw.toISOString() : String(raw || '');
            depDate = iso.substring(0, 10);
        } catch { }

        if (!depDate || !/^\d{4}-\d{2}-\d{2}$/.test(depDate)) {
            depDate = new Date().toISOString().substring(0, 10);
        }

        let depTime = '00:00';
        try {
            const rt = String(data.departureTime || data.fmtTime || '');
            if (rt) depTime = rt.substring(0, 5);
        } catch { }

        const localDT = `${depDate}T${depTime}:00`;
        const safeDate = (depDate || 'nodate').replace(/-/g, '');
        const classId = `${issuerId}.${carrierCode}${flightNum}_${safeDate}`;
        const objectId = `${issuerId}.${String(data.ticketNumber).replace(/[^a-zA-Z0-9_-]/g, '_')}`;

        const isFirst = data.classType === 'FIRST';
        const classLabel = isFirst ? 'First Class' : 'Economy';
        const hexBg = isFirst ? '#7C2D12' : '#1E3A8A';

        const passPayload = {
            flightClasses: [{
                id: classId,
                issuerName: 'Aerolineas Pabon',
                reviewStatus: 'APPROVED',
                hexBackgroundColor: hexBg,
                flightHeader: {
                    carrier: {
                        carrierIataCode: carrierCode,
                        airlineName: {
                            defaultValue: {
                                language: 'en-US',
                                value: 'Aerolineas Pabon'
                            }
                        }
                    },
                    flightNumber: flightNum,
                    flightNumberDisplayOverride: String(data.flightNumber || '')
                },
                origin: {
                    airportIataCode: String(data.origin || ''),
                    gate: String(data.gate || '')
                },
                destination: {
                    airportIataCode: String(data.destination || '')
                },
                localScheduledDepartureDateTime: localDT
            }],
            flightObjects: [{
                id: objectId,
                classId,
                state: 'ACTIVE',
                hexBackgroundColor: hexBg,
                passengerName: String(data.passengerName || '').toUpperCase(),
                reservationInfo: {
                    confirmationCode: String(data.ticketNumber || '')
                },
                boardingAndSeatingInfo: {
                    seatNumber: String(data.seatNumber || ''),
                    seatClass: classLabel
                },
                barcode: {
                    type: 'QR_CODE',
                    value: String(data.ticketNumber || ''),
                    alternateText: String(data.ticketNumber || '')
                },
                textModulesData: [
                    { id: 'gate', header: 'GATE', body: String(data.gate || 'TBD') },
                    { id: 'class', header: 'CLASS', body: classLabel }
                ]
            }]
        };

        const token = jwt.sign(
            {
                iss: svcEmail,
                aud: 'google',
                typ: 'savetowallet',
                payload: passPayload,
                iat: Math.floor(Date.now() / 1000)
            },
            privateKey,
            { algorithm: 'RS256' }
        );

        return `https://pay.google.com/gp/v/save/${token}`;
    } catch (err) {
        console.error('[GoogleWallet] JWT error:', err.message);
        return null;
    }
}

// ======================================================
// INYECTAR SERVICIOS
// ======================================================

app.use((req, res, next) => {
    req.nodeId = NODE_ID;
    req.nodeName = NODE_NAME;
    req.syncService = syncService;
    req.bookingService = bookingService;
    req.itineraryService = itineraryService;
    next();
});

// ======================================================
// DIJKSTRA DESDE BASE DE DATOS
// ======================================================

async function loadRoutesFromDatabase() {
    try {
        dijkstraService.graph.clear();

        const result = await pool.query(`
            SELECT
                origin_code,
                destination_code,
                MIN(COALESCE(economy_price, 0)) AS cost,
                MIN(COALESCE(flight_duration_hours, 1)) AS time
            FROM flights
            WHERE origin_code IS NOT NULL
              AND destination_code IS NOT NULL
              AND origin_code <> destination_code
              AND status <> 'CANCELLED'
            GROUP BY origin_code, destination_code
            ORDER BY origin_code, destination_code
        `);

        const airportSet = new Set();

        for (const row of result.rows) {
            const cost = Number(row.cost || 0);
            const time = Number(row.time || 1);

            if (cost > 0) {
                dijkstraService.addRoute(
                    row.origin_code,
                    row.destination_code,
                    cost,
                    time
                );

                airportSet.add(row.origin_code);
                airportSet.add(row.destination_code);
            }
        }

        dijkstraService.airports = Array.from(airportSet).sort();

        console.log('[Dijkstra] Grafo cargado desde PostgreSQL con ' + result.rows.length + ' rutas');
        console.log('[Dijkstra] Aeropuertos cargados: ' + dijkstraService.airports.length);
    } catch (error) {
        console.error('[Dijkstra] Error cargando rutas desde la base:', error);
        throw error;
    }
}

// ======================================================
// HEALTH
// ======================================================

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        nodeId: NODE_ID,
        nodeName: NODE_NAME,
        vectorClock: syncService ? syncService.getVectorClock() : null,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/v1/vector-clock', (req, res) => {
    res.json({
        nodeId: NODE_ID,
        nodeName: NODE_NAME,
        vectorClock: syncService ? syncService.getVectorClock() : null
    });
});

// ======================================================
// PASAJEROS
// ======================================================

app.post('/api/v1/passenger', async (req, res) => {
    const { passport_number, first_name, last_name, email, phone } = req.body;

    if (!passport_number || !first_name || !last_name) {
        return res.status(400).json({
            error: 'Faltan campos requeridos: passport_number, first_name, last_name'
        });
    }

    try {
        const existing = await pool.query(
            'SELECT * FROM passengers WHERE passport_number = $1',
            [passport_number]
        );

        if (existing.rows.length > 0) {
            return res.json(existing.rows[0]);
        }

        const result = await pool.query(
            `INSERT INTO passengers (passport_number, first_name, last_name, email, phone)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [passport_number, first_name, last_name, email || null, phone || null]
        );

        res.json(result.rows[0]);
    } catch (error) {
        console.error('[Passenger] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/v1/passenger/search', async (req, res) => {
    const { passport } = req.query;

    if (!passport) {
        return res.status(400).json({ error: 'passport es requerido' });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM passengers WHERE passport_number = $1',
            [passport]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Pasajero no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/v1/passengers', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM passengers ORDER BY id DESC LIMIT 50'
        );
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ======================================================
// ASIENTOS / BOOKING
// ======================================================

app.get('/api/v1/seat/availability', async (req, res) => {
    const { flightId, seatNumber } = req.query;

    if (!flightId || !seatNumber) {
        return res.status(400).json({ error: 'flightId y seatNumber son requeridos' });
    }

    const availability = await bookingService.checkAvailability(
        parseInt(flightId),
        seatNumber
    );

    res.json(availability);
});

app.post('/api/v1/seat/reserve', async (req, res) => {
    const { flightId, seatNumber, passengerId, classType } = req.body;

    if (!flightId || !seatNumber || !passengerId || !classType) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const result = await bookingService.reserveSeat(
        parseInt(flightId),
        seatNumber,
        parseInt(passengerId),
        classType
    );

    if (result.success) {
        res.json(result);
    } else {
        res.status(409).json(result);
    }
});

app.post('/api/v1/seat/sell', async (req, res) => {
    const { flightId, seatNumber, passengerId, classType, price } = req.body;

    if (
        flightId === undefined ||
        !seatNumber ||
        passengerId === undefined ||
        !classType ||
        price === undefined
    ) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const result = await bookingService.sellSeat(
        parseInt(flightId),
        seatNumber,
        parseInt(passengerId),
        classType,
        parseFloat(price)
    );

    if (result.success) {
        res.json(result);
    } else {
        res.status(409).json(result);
    }
});

app.post('/api/v1/seat/refund', async (req, res) => {
    const { flightId, seatNumber, passengerId } = req.body;

    if (!flightId || !seatNumber || !passengerId) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    const result = await bookingService.refundSeat(
        parseInt(flightId),
        seatNumber,
        parseInt(passengerId)
    );

    if (result.success) {
        res.json(result);
    } else {
        res.status(409).json(result);
    }
});

// ======================================================
// ITINERARIOS CON ESCALAS
// ======================================================

app.post('/api/v1/itinerary/quote', async (req, res) => {
    try {
        const result = await itineraryService.quoteItinerary(req.body);
        res.json(result);
    } catch (error) {
        console.error('[Itinerary Quote] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/v1/itinerary/reserve', async (req, res) => {
    try {
        const result = await itineraryService.reserveItinerary(req.body);
        if (result.success) {
            res.json(result);
        } else {
            res.status(409).json(result);
        }
    } catch (error) {
        console.error('[Itinerary Reserve] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/v1/itinerary/buy', async (req, res) => {
    try {
        const result = await itineraryService.buyItinerary(req.body);
        if (result.success) {
            res.json(result);
        } else {
            res.status(409).json(result);
        }
    } catch (error) {
        console.error('[Itinerary Buy] Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ======================================================
// RUTAS / DIJKSTRA
// ======================================================

app.get('/api/v1/airports', (req, res) => {
    res.json({
        count: dijkstraService.getAirports().length,
        airports: dijkstraService.getAirports()
    });
});

app.get('/api/v1/routes/cheapest', (req, res) => {
    const { origin, destination } = req.query;

    if (!origin || !destination) {
        return res.status(400).json({ error: 'origin y destination son requeridos' });
    }

    const result = dijkstraService.findCheapestRoute(
        origin.toUpperCase(),
        destination.toUpperCase()
    );

    res.json(result);
});

app.get('/api/v1/routes/fastest', (req, res) => {
    const { origin, destination } = req.query;

    if (!origin || !destination) {
        return res.status(400).json({ error: 'origin y destination son requeridos' });
    }

    const result = dijkstraService.findFastestRoute(
        origin.toUpperCase(),
        destination.toUpperCase()
    );

    res.json(result);
});

app.get('/api/v1/routes/direct', (req, res) => {
    const { origin, destination } = req.query;

    if (!origin || !destination) {
        return res.status(400).json({ error: 'origin y destination son requeridos' });
    }

    const exists = dijkstraService.hasDirectRoute(
        origin.toUpperCase(),
        destination.toUpperCase()
    );

    const route = dijkstraService.getDirectRoute(
        origin.toUpperCase(),
        destination.toUpperCase()
    );

    res.json({
        direct: exists,
        route,
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase()
    });
});

app.post('/api/v1/routes/multi-destination', (req, res) => {
    const { start, destinations } = req.body;

    if (!start || !destinations || !Array.isArray(destinations) || destinations.length === 0) {
        return res.status(400).json({
            error: 'start y destinations (array) son requeridos'
        });
    }

    const result = dijkstraService.findAllPossibleRoutes(
        start.toUpperCase(),
        destinations.map((d) => d.toUpperCase())
    );

    if (result.length === 0) {
        return res.json({ found: false, error: 'No se encontraron rutas validas' });
    }

    const sortedByCost = [...result].sort((a, b) => a.totalCost - b.totalCost);
    const sortedByTime = [...result].sort((a, b) => a.totalTime - b.totalTime);

    res.json({
        found: true,
        cheapest: sortedByCost[0],
        fastest: sortedByTime[0],
        allRoutes: result
    });
});

app.get('/api/v1/routes/options', async (req, res) => {
    const { origin, destination } = req.query;

    if (!origin || !destination) {
        return res.status(400).json({ error: 'origin y destination son requeridos' });
    }

    try {
        const cheapest = dijkstraService.findCheapestRoute(
            origin.toUpperCase(),
            destination.toUpperCase()
        );

        const fastest = dijkstraService.findFastestRoute(
            origin.toUpperCase(),
            destination.toUpperCase()
        );

        res.json({
            success: true,
            origin: origin.toUpperCase(),
            destination: destination.toUpperCase(),
            cheapest,
            fastest
        });
    } catch (error) {
        console.error('[Routes Options] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ======================================================
// VUELOS
// ======================================================

app.get('/api/v1/flights/valid-origins', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT DISTINCT origin_code
            FROM flights
            WHERE origin_code IS NOT NULL
            ORDER BY origin_code ASC
        `);

        res.json({
            success: true,
            origins: result.rows.map((row) => row.origin_code)
        });
    } catch (error) {
        console.error('[Flights Valid Origins] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/v1/flights/destinations', async (req, res) => {
    const { origin } = req.query;

    if (!origin) {
        return res.status(400).json({ error: 'origin es requerido' });
    }

    try {
        const allAirports = dijkstraService.getAirports();
        const originCode = origin.toUpperCase();
        const reachable = [];

        for (const airport of allAirports) {
            if (airport === originCode) continue;

            const route = dijkstraService.findCheapestRoute(originCode, airport);
            if (route.found) {
                reachable.push({
                    code: airport,
                    totalCost: route.totalCost,
                    totalTime: route.totalTime,
                    stops: route.stops,
                    route: route.route
                });
            }
        }

        reachable.sort((a, b) => a.code.localeCompare(b.code));

        res.json({
            success: true,
            origin: originCode,
            destinations: reachable
        });
    } catch (error) {
        console.error('[Flights Destinations Reachable] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/v1/flights/origins', async (req, res) => {
    const { destination } = req.query;

    if (!destination) {
        return res.status(400).json({ error: 'destination es requerido' });
    }

    try {
        const result = await pool.query(`
            SELECT DISTINCT origin_code
            FROM flights
            WHERE destination_code = $1
              AND origin_code IS NOT NULL
            ORDER BY origin_code ASC
        `, [destination.toUpperCase()]);

        res.json({
            success: true,
            destination: destination.toUpperCase(),
            origins: result.rows.map((row) => row.origin_code)
        });
    } catch (error) {
        console.error('[Flights Origins] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/v1/flights/available-dates', async (req, res) => {
    const { origin, destination } = req.query;

    let query = 'SELECT DISTINCT departure_date FROM flights WHERE 1=1';
    const params = [];

    if (origin) {
        query += ` AND origin_code = $${params.length + 1}`;
        params.push(origin.toUpperCase());
    }

    if (destination) {
        query += ` AND destination_code = $${params.length + 1}`;
        params.push(destination.toUpperCase());
    }

    query += ' ORDER BY departure_date ASC';

    try {
        const result = await pool.query(query, params);
        res.json({
            success: true,
            minDate: result.rows[0]?.departure_date || null,
            maxDate: result.rows[result.rows.length - 1]?.departure_date || null,
            dates: result.rows.map((row) => row.departure_date)
        });
    } catch (error) {
        console.error('[Flights Available Dates] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/v1/flights', async (req, res) => {
    const { origin, destination, startDate, endDate, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    if (!origin && !destination && !startDate && !endDate) {
        return res.status(400).json({
            error: 'Se requiere al menos un filtro (origen, destino o fecha)'
        });
    }

    let query = 'SELECT * FROM flights WHERE 1=1';
    const params = [];

    if (origin) {
        query += ` AND origin_code = $${params.length + 1}`;
        params.push(origin.toUpperCase());
    }

    if (destination) {
        query += ` AND destination_code = $${params.length + 1}`;
        params.push(destination.toUpperCase());
    }

    if (startDate) {
        query += ` AND departure_date >= $${params.length + 1}`;
        params.push(startDate);
    }

    if (endDate) {
        query += ` AND departure_date <= $${params.length + 1}`;
        params.push(endDate);
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    query += ' ORDER BY departure_date ASC, departure_time ASC';
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);

    try {
        const result = await pool.query(query, params);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
                hasNext: parseInt(page) < Math.ceil(total / parseInt(limit)),
                hasPrev: parseInt(page) > 1
            }
        });
    } catch (error) {
        console.error('[Flights] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/v1/flights/:flightId/seats', async (req, res) => {
    const { flightId } = req.params;

    try {
        const flightResult = await pool.query(
            `SELECT f.*, a.first_class_seats, a.economy_seats
             FROM flights f
             LEFT JOIN aircrafts a ON f.aircraft_id = a.id
             WHERE f.id = $1`,
            [flightId]
        );

        if (flightResult.rows.length === 0) {
            return res.status(404).json({ error: 'Vuelo no encontrado' });
        }

        const flight = flightResult.rows[0];
        const columns = ['A', 'B', 'C', 'D', 'E', 'F'];
        const firstClassRows = Math.ceil((flight.first_class_seats || 12) / columns.length);
        const economyRows = Math.ceil((flight.economy_seats || 120) / columns.length);

        const SeatState = require('./models/mongodb/SeatState.model');
        const seatStates = await SeatState.find({ flight_id: parseInt(flightId) });

        const stateMap = {};
        seatStates.forEach((s) => {
            stateMap[s.seat_number] = s.status;
        });

        const seats = [];
        for (let row = 1; row <= firstClassRows + economyRows; row++) {
            for (const col of columns) {
                const seatNumber = row + col;
                seats.push({
                    seat_number: seatNumber,
                    class_type: row <= firstClassRows ? 'FIRST' : 'ECONOMY',
                    status: stateMap[seatNumber] || 'AVAILABLE'
                });
            }
        }

        res.json({
            flightId: parseInt(flightId),
            seats
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ======================================================
// DASHBOARD
// ======================================================

app.get('/api/v1/dashboard/stats', async (req, res) => {
    if (!dashboardController) {
        return res.status(503).json({ error: 'Dashboard no disponible aún' });
    }
    await dashboardController.getDashboardStats(req, res);
});

app.get('/api/v1/dashboard/flight/:flightId/occupancy', async (req, res) => {
    if (!dashboardController) {
        return res.status(503).json({ error: 'Dashboard no disponible aún' });
    }
    await dashboardController.getFlightOccupancy(req, res);
});

app.get('/api/v1/dashboard/top-routes', async (req, res) => {
    if (!dashboardController) {
        return res.status(503).json({ error: 'Dashboard no disponible aún' });
    }
    await dashboardController.getTopRoutes(req, res);
});

// ======================================================
// PDF Y WALLET
// ======================================================

app.get('/api/v1/boarding-pass/pdf', async (req, res) => {
    const { ticket } = req.query;

    if (!ticket) {
        return res.status(400).json({ error: 'ticket es requerido' });
    }

    try {
        const sale = await pool.query(
            `SELECT s.ticket_number, s.seat_number, s.class_type, s.price_paid,
                    f.flight_number, f.origin_code, f.destination_code,
                    f.departure_date, f.departure_time, f.gate, f.flight_duration_hours,
                    p.first_name, p.last_name, p.passport_number
             FROM sales s
             JOIN flights f ON s.flight_id = f.id
             JOIN passengers p ON s.passenger_id = p.id
             WHERE s.ticket_number = $1`,
            [ticket]
        );

        if (sale.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket no encontrado' });
        }

        const data = sale.rows[0];

        const result = await pdfGenerator.generateBoardingPass({
            ticketNumber: data.ticket_number,
            passengerName: data.first_name + ' ' + data.last_name,
            passportNumber: data.passport_number,
            flightNumber: data.flight_number,
            origin: data.origin_code,
            destination: data.destination_code,
            departureDate: data.departure_date,
            departureTime: data.departure_time,
            seatNumber: data.seat_number,
            classType: data.class_type,
            gate: data.gate,
            price: data.price_paid,
            durationHours: data.flight_duration_hours
        });

        if (result.success) {
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.setHeader('Content-Type', 'application/pdf');

            res.download(result.filePath, result.filename, (err) => {
                if (err) console.error('[PDF] Error sending file:', err);

                setTimeout(() => {
                    if (fs.existsSync(result.filePath)) fs.unlinkSync(result.filePath);
                }, 5000);
            });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        console.error('[PDF] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/v1/boarding-pass/wallet', async (req, res) => {
    const { ticket } = req.query;
    if (!ticket) return res.status(400).json({ error: 'ticket es requerido' });

    try {
        const sale = await pool.query(
            `SELECT s.ticket_number, s.seat_number, s.class_type, s.price_paid,
                    f.flight_number, f.origin_code, f.destination_code,
                    f.departure_date, f.departure_time, f.gate, f.flight_duration_hours,
                    p.first_name, p.last_name, p.passport_number
             FROM sales s
             JOIN flights f ON s.flight_id = f.id
             JOIN passengers p ON s.passenger_id = p.id
             WHERE s.ticket_number = $1`,
            [ticket]
        );

        if (sale.rows.length === 0) {
            return res.status(404).json({ error: 'Ticket no encontrado' });
        }

        const d = sale.rows[0];
        const passengerName = `${d.first_name} ${d.last_name}`;

        const baseUrl = getPublicBaseUrl(req);
        const viewUrl = `${baseUrl}/api/v1/boarding-pass/view?ticket=${encodeURIComponent(ticket)}`;

        const qrBuffer = await QRCode.toBuffer(viewUrl, {
            errorCorrectionLevel: 'M',
            margin: 3,
            width: 400,
            color: { dark: '#142258', light: '#ffffff' }
        });

        const qrCode = `data:image/png;base64,${qrBuffer.toString('base64')}`;

        let fmtDate = '';
        try {
            const raw = d.departure_date;
            const iso = raw instanceof Date ? raw.toISOString() : String(raw || '');
            const dt = new Date(iso.substring(0, 10) + 'T12:00:00Z');
            fmtDate = dt.toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric'
            });
        } catch {
            fmtDate = String(d.departure_date || '');
        }

        const googleWalletUrl = buildGoogleWalletUrl({
            ticketNumber: d.ticket_number,
            passengerName,
            flightNumber: d.flight_number,
            origin: d.origin_code,
            destination: d.destination_code,
            departureDate: d.departure_date,
            departureTime: d.departure_time,
            fmtDate,
            seatNumber: d.seat_number,
            classType: d.class_type,
            gate: d.gate
        });

        res.json({
            success: true,
            qrCode,
            viewUrl,
            googleWalletUrl,
            hasGoogleWallet: !!googleWalletUrl,
            instructions: 'Scan QR to open your boarding pass, or tap the Google Wallet button on Android'
        });
    } catch (error) {
        console.error('[Wallet] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/v1/boarding-pass/view', async (req, res) => {
    const { ticket } = req.query;
    if (!ticket) return res.status(400).send('<h1>Ticket number required</h1>');

    try {
        const result = await pool.query(
            `SELECT s.ticket_number, s.seat_number, s.class_type, s.price_paid, s.booking_reference,
                    f.flight_number, f.origin_code, f.destination_code,
                    f.departure_date, f.departure_time, f.gate, f.flight_duration_hours,
                    p.first_name, p.last_name, p.passport_number
             FROM sales s
             JOIN flights f ON s.flight_id = f.id
             JOIN passengers p ON s.passenger_id = p.id
             WHERE s.ticket_number = $1`,
            [ticket]
        );

        if (result.rows.length === 0) {
            return res.status(404).send('<h1>Ticket not found</h1>');
        }

        const d = result.rows[0];

        const CITIES = {
            ATL: 'Atlanta, USA',
            DFW: 'Dallas, USA',
            LON: 'London, UK',
            LHR: 'London, UK',
            PEK: 'Beijing, China',
            DXB: 'Dubai, UAE',
            TYO: 'Tokyo, Japan',
            NRT: 'Tokyo, Japan',
            PAR: 'Paris, France',
            CDG: 'Paris, France',
            LAX: 'Los Angeles, USA',
            JFK: 'New York, USA',
            FRA: 'Frankfurt, Germany',
            IST: 'Istanbul, Turkey',
            SIN: 'Singapore',
            MAD: 'Madrid, Spain',
            AMS: 'Amsterdam, NL',
            CAN: 'Guangzhou, China',
            SAO: 'Sao Paulo, Brazil',
            SYD: 'Sydney, Australia',
            BOG: 'Bogota, Colombia',
            MIA: 'Miami, USA',
            ORD: 'Chicago, USA'
        };

        let fmtDate = '';
        try {
            const raw = d.departure_date;
            const iso = raw instanceof Date ? raw.toISOString() : String(raw || '');
            const dt = new Date(iso.substring(0, 10) + 'T12:00:00Z');
            fmtDate = dt.toLocaleDateString('en-US', {
                month: 'short',
                day: '2-digit',
                year: 'numeric'
            });
        } catch {
            fmtDate = String(d.departure_date || '');
        }

        const fmtTime = String(d.departure_time || '').substring(0, 5);

        let duration = '';
        if (d.flight_duration_hours) {
            const h = Math.floor(Number(d.flight_duration_hours));
            const m = Math.round((Number(d.flight_duration_hours) - h) * 60);
            duration = m > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`;
        }

        const passengerName = `${d.first_name} ${d.last_name}`;
        const price = '$' + parseFloat(d.price_paid || 0).toLocaleString();

        const qrBuffer = await QRCode.toBuffer(
            JSON.stringify({
                ticket: d.ticket_number,
                flight: d.flight_number,
                passenger: passengerName,
                seat: d.seat_number,
                from: d.origin_code,
                to: d.destination_code,
                date: fmtDate,
                gate: d.gate,
                class: d.class_type
            }),
            {
                errorCorrectionLevel: 'M',
                width: 240,
                margin: 2,
                color: { dark: '#0D1B4B', light: '#ffffff' }
            }
        );

        const qrDataUrl = `data:image/png;base64,${qrBuffer.toString('base64')}`;

        const googleWalletUrl = buildGoogleWalletUrl({
            ticketNumber: d.ticket_number,
            passengerName,
            flightNumber: d.flight_number,
            origin: d.origin_code,
            destination: d.destination_code,
            departureDate: d.departure_date,
            departureTime: d.departure_time,
            fmtDate,
            seatNumber: d.seat_number,
            classType: d.class_type,
            gate: d.gate
        });

        const html = pdfGenerator.generateViewHtml({
            ticketNumber: d.ticket_number,
            passengerName,
            passportNumber: d.passport_number,
            flightNumber: d.flight_number,
            origin: d.origin_code,
            destination: d.destination_code,
            originCity: CITIES[d.origin_code] || '',
            destCity: CITIES[d.destination_code] || '',
            fmtDate,
            fmtTime,
            duration,
            seatNumber: d.seat_number,
            classType: d.class_type,
            gate: d.gate,
            price,
            bookingReference: d.booking_reference,
            googleWalletUrl: googleWalletUrl || ''
        }, qrDataUrl);

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.send(html);
    } catch (error) {
        console.error('[View] Error:', error);
        res.status(500).send('<h1>Error loading boarding pass</h1>');
    }
});

// ======================================================
// START SERVER
// ======================================================

const startServer = async () => {
    try {
        await connectMongoDB();
        await connectRedis();

        await pool.query('SELECT NOW()');
        console.log('[DB] PostgreSQL connected');

        await loadRoutesFromDatabase();

        syncService = new SyncService(NODE_ID, NODE_NAME);
        const syncConnected = await syncService.connect();

        if (syncConnected) {
            console.log('[Sync] RabbitMQ connected - Modo distribuido ACTIVADO');
        } else {
            console.log('[Sync] RabbitMQ no disponible - Modo STANDALONE');
        }

        bookingService = new BookingService(NODE_ID, NODE_NAME, syncService);
        itineraryService = new ItineraryService(bookingService);
        dashboardController = new DashboardController(syncService, NODE_ID, NODE_NAME);

        app.listen(PORT, () => {
            console.log('');
            console.log('========================================');
            console.log('Nodo ' + NODE_ID + ': ' + NODE_NAME);
            console.log('Puerto: ' + PORT);
            console.log('Reloj Vectorial: ' + JSON.stringify(syncService.getVectorClock()));
            console.log('========================================');
            console.log('');
            console.log('Endpoints disponibles:');
            console.log('');
            console.log('--- HEALTH ---');
            console.log('  GET  /health');
            console.log('  GET  /api/v1/vector-clock');
            console.log('');
            console.log('--- PASAJEROS ---');
            console.log('  POST /api/v1/passenger');
            console.log('  GET  /api/v1/passenger/search?passport=');
            console.log('  GET  /api/v1/passengers');
            console.log('');
            console.log('--- ASIENTOS (Booking) ---');
            console.log('  GET  /api/v1/seat/availability?flightId=&seatNumber=');
            console.log('  POST /api/v1/seat/reserve');
            console.log('  POST /api/v1/seat/sell');
            console.log('  POST /api/v1/seat/refund');
            console.log('');
            console.log('--- ITINERARIOS ---');
            console.log('  POST /api/v1/itinerary/quote');
            console.log('  POST /api/v1/itinerary/reserve');
            console.log('  POST /api/v1/itinerary/buy');
            console.log('');
            console.log('--- RUTAS (Dijkstra) ---');
            console.log('  GET  /api/v1/airports');
            console.log('  GET  /api/v1/routes/cheapest?origin=&destination=');
            console.log('  GET  /api/v1/routes/fastest?origin=&destination=');
            console.log('  GET  /api/v1/routes/direct?origin=&destination=');
            console.log('  GET  /api/v1/routes/options?origin=&destination=');
            console.log('  POST /api/v1/routes/multi-destination');
            console.log('');
            console.log('--- VUELOS ---');
            console.log('  GET  /api/v1/flights/valid-origins');
            console.log('  GET  /api/v1/flights/destinations?origin=');
            console.log('  GET  /api/v1/flights/origins?destination=');
            console.log('  GET  /api/v1/flights?origin=&destination=&startDate=&endDate=&page=&limit=');
            console.log('  GET  /api/v1/flights/available-dates?origin=&destination=');
            console.log('  GET  /api/v1/flights/:flightId/seats');
            console.log('');
            console.log('--- DASHBOARD ---');
            console.log('  GET  /api/v1/dashboard/stats');
            console.log('  GET  /api/v1/dashboard/flight/:flightId/occupancy');
            console.log('  GET  /api/v1/dashboard/top-routes');
            console.log('');
            console.log('--- PDF Y WALLET ---');
            console.log('  GET  /api/v1/boarding-pass/pdf?ticket=');
            console.log('  GET  /api/v1/boarding-pass/wallet?ticket=');
            console.log('');

            const gwIssuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
            const gwKeyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;

            if (!gwIssuerId && !gwKeyFile) {
                console.log('[GoogleWallet] ⚠ No configurado — el boton no aparecera');
            } else {
                let gwEmail = null;
                let gwKeyOk = false;

                try {
                    const kp = path.resolve(__dirname, '..', gwKeyFile || '');
                    const k = JSON.parse(fs.readFileSync(kp, 'utf8'));
                    gwEmail = k.client_email;
                    gwKeyOk = !!(k.private_key && k.private_key.includes('BEGIN'));
                } catch { }

                if (!gwEmail) {
                    gwEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '(no configurado)';
                }

                console.log('[GoogleWallet] Issuer ID : ' + (gwIssuerId || '(FALTANTE)'));
                console.log('[GoogleWallet] Account   : ' + gwEmail);
                console.log('[GoogleWallet] Key file  : ' + (gwKeyOk ? 'OK' : 'ERROR - no se pudo leer'));

                if (gwIssuerId && gwEmail && gwKeyOk) {
                    console.log('[GoogleWallet] Estado    : LISTO');
                } else {
                    console.log('[GoogleWallet] Estado    : INCOMPLETO - revisa las vars de entorno');
                }
            }

            console.log('');
        });
    } catch (error) {
        console.error('[Fatal] Error starting server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;