require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');

const SyncService = require('./services/sync.service');
const BookingService = require('./services/booking.service');
const DijkstraService = require('./services/dijkstra.service');
const DashboardController = require('./controllers/dashboard.controller');
const PDFGeneratorService = require('./services/pdf-generator.service');
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

// Inicializar servicios
let syncService = null;
let bookingService = null;
let dashboardController = null;
const dijkstraService = new DijkstraService();
const pdfGenerator = new PDFGeneratorService();

// Cargar rutas de ejemplo para Dijkstra
dijkstraService.addRoute('ATL', 'DFW', 250, 2.5);
dijkstraService.addRoute('ATL', 'LON', 800, 8.5);
dijkstraService.addRoute('ATL', 'DXB', 1200, 14.0);
dijkstraService.addRoute('ATL', 'TYO', 1400, 15.0);
dijkstraService.addRoute('DFW', 'LON', 700, 9.0);
dijkstraService.addRoute('DFW', 'PEK', 1100, 13.5);
dijkstraService.addRoute('LON', 'PEK', 650, 10.0);
dijkstraService.addRoute('LON', 'DXB', 500, 7.0);
dijkstraService.addRoute('DXB', 'PEK', 600, 8.0);
dijkstraService.addRoute('DXB', 'TYO', 900, 10.5);
dijkstraService.addRoute('PEK', 'TYO', 400, 4.5);
dijkstraService.addRoute('LON', 'TYO', 1100, 12.0);

// Middleware para inyectar servicios en las rutas
app.use((req, res, next) => {
    req.nodeId = NODE_ID;
    req.nodeName = NODE_NAME;
    req.syncService = syncService;
    req.bookingService = bookingService;
    next();
});

// ============================================
// API ENDPOINTS - HEALTH Y ESTADO
// ============================================

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

// ============================================
// API ENDPOINTS - PASAJEROS
// ============================================

app.post('/api/v1/passenger', async (req, res) => {
    const { passport_number, first_name, last_name, email, phone } = req.body;
    
    console.log('[Passenger] Solicitud recibida:', { passport_number, first_name, last_name });
    
    if (!passport_number || !first_name || !last_name) {
        return res.status(400).json({ error: 'Faltan campos requeridos: passport_number, first_name, last_name' });
    }
    
    try {
        const existing = await pool.query(
            'SELECT * FROM passengers WHERE passport_number = $1',
            [passport_number]
        );
        
        if (existing.rows.length > 0) {
            console.log('[Passenger] Pasajero existente:', existing.rows[0].id);
            return res.json(existing.rows[0]);
        }
        
        const result = await pool.query(
            `INSERT INTO passengers (passport_number, first_name, last_name, email, phone) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [passport_number, first_name, last_name, email || null, phone || null]
        );
        
        console.log('[Passenger] Pasajero creado:', result.rows[0].id);
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
        const result = await pool.query('SELECT * FROM passengers ORDER BY id DESC LIMIT 50');
        res.json(result.rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// API ENDPOINTS - ASIENTOS (BOOKING)
// ============================================

app.get('/api/v1/seat/availability', async (req, res) => {
    const { flightId, seatNumber } = req.query;
    
    if (!flightId || !seatNumber) {
        return res.status(400).json({ error: 'flightId y seatNumber son requeridos' });
    }
    
    const availability = await bookingService.checkAvailability(parseInt(flightId), seatNumber);
    res.json(availability);
});

app.post('/api/v1/seat/reserve', async (req, res) => {
    const { flightId, seatNumber, passengerId, classType } = req.body;
    
    if (!flightId || !seatNumber || !passengerId || !classType) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    const result = await bookingService.reserveSeat(flightId, seatNumber, passengerId, classType);
    
    if (result.success) {
        res.json(result);
    } else {
        res.status(409).json(result);
    }
});

app.post('/api/v1/seat/sell', async (req, res) => {
    const { flightId, seatNumber, passengerId, classType, price } = req.body;
    
    if (!flightId || !seatNumber || !passengerId || !classType || !price) {
        return res.status(400).json({ error: 'Faltan campos requeridos' });
    }
    
    const result = await bookingService.sellSeat(flightId, seatNumber, passengerId, classType, price);
    
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
    
    const result = await bookingService.refundSeat(flightId, seatNumber, passengerId);
    
    if (result.success) {
        res.json(result);
    } else {
        res.status(409).json(result);
    }
});

// ============================================
// API ENDPOINTS - DIJKSTRA (RUTAS OPTIMAS)
// ============================================

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
    
    const result = dijkstraService.findCheapestRoute(origin.toUpperCase(), destination.toUpperCase());
    res.json(result);
});

app.get('/api/v1/routes/fastest', (req, res) => {
    const { origin, destination } = req.query;
    
    if (!origin || !destination) {
        return res.status(400).json({ error: 'origin y destination son requeridos' });
    }
    
    const result = dijkstraService.findFastestRoute(origin.toUpperCase(), destination.toUpperCase());
    res.json(result);
});

app.get('/api/v1/routes/direct', (req, res) => {
    const { origin, destination } = req.query;
    
    if (!origin || !destination) {
        return res.status(400).json({ error: 'origin y destination son requeridos' });
    }
    
    const exists = dijkstraService.hasDirectRoute(origin.toUpperCase(), destination.toUpperCase());
    const route = dijkstraService.getDirectRoute(origin.toUpperCase(), destination.toUpperCase());
    
    res.json({ 
        direct: exists, 
        route: route,
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase()
    });
});

app.post('/api/v1/routes/multi-destination', (req, res) => {
    const { start, destinations } = req.body;
    
    if (!start || !destinations || !Array.isArray(destinations) || destinations.length === 0) {
        return res.status(400).json({ error: 'start y destinations (array) son requeridos' });
    }
    
    const result = dijkstraService.findAllPossibleRoutes(start.toUpperCase(), destinations.map(d => d.toUpperCase()));
    
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

// ============================================
// API ENDPOINTS - DASHBOARD GERENCIAL
// ============================================

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

// ============================================
// API ENDPOINTS - PDF Y WALLET (GET con query params)
// ============================================

app.get('/api/v1/boarding-pass/pdf', async (req, res) => {
    const { ticket } = req.query;
    
    if (!ticket) {
        return res.status(400).json({ error: 'ticket es requerido' });
    }
    
    try {
        const sale = await pool.query(
            `SELECT s.*, f.flight_number, f.origin_code, f.destination_code, f.departure_date, f.departure_time, f.gate,
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
            boardingTime: data.departure_time,
            price: data.price_paid
        });
        
        if (result.success) {
            res.download(result.filePath, result.filename, (err) => {
                if (err) {
                    console.error('[PDF] Error sending file:', err);
                }
                setTimeout(() => {
                    if (fs.existsSync(result.filePath)) {
                        fs.unlinkSync(result.filePath);
                    }
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
    
    if (!ticket) {
        return res.status(400).json({ error: 'ticket es requerido' });
    }
    
    try {
        const sale = await pool.query(
            `SELECT s.*, f.flight_number, f.origin_code, f.destination_code, f.departure_date, f.departure_time, f.gate,
             p.first_name, p.last_name
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
        
        const result = await pdfGenerator.generateWalletPass({
            ticketNumber: data.ticket_number,
            passengerName: data.first_name + ' ' + data.last_name,
            flightNumber: data.flight_number,
            origin: data.origin_code,
            destination: data.destination_code,
            departureDate: data.departure_date,
            departureTime: data.departure_time,
            seatNumber: data.seat_number,
            gate: data.gate
        });
        
        if (result.success) {
            res.json({
                success: true,
                walletPass: result.passData,
                qrCode: result.qrCode,
                instructions: 'Escanea el código QR para agregar el pase a tu Wallet',
                message: 'Wallet pass generado exitosamente'
            });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        console.error('[Wallet] Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// INICIAR SERVIDOR
// ============================================

const startServer = async () => {
    try {
        await connectMongoDB();
        await connectRedis();
        
        await pool.query('SELECT NOW()');
        console.log('[DB] PostgreSQL connected');
        
        syncService = new SyncService(NODE_ID, NODE_NAME);
        const syncConnected = await syncService.connect();
        
        if (syncConnected) {
            console.log('[Sync] RabbitMQ connected - Modo distribuido ACTIVADO');
        } else {
            console.log('[Sync] RabbitMQ no disponible - Modo STANDALONE');
        }
        
        bookingService = new BookingService(NODE_ID, NODE_NAME, syncService);
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
            console.log('--- RUTAS (Dijkstra) ---');
            console.log('  GET  /api/v1/airports');
            console.log('  GET  /api/v1/routes/cheapest?origin=&destination=');
            console.log('  GET  /api/v1/routes/fastest?origin=&destination=');
            console.log('  GET  /api/v1/routes/direct?origin=&destination=');
            console.log('  POST /api/v1/routes/multi-destination');
            console.log('');
            console.log('--- DASHBOARD (20 pts) ---');
            console.log('  GET  /api/v1/dashboard/stats');
            console.log('  GET  /api/v1/dashboard/flight/:flightId/occupancy');
            console.log('  GET  /api/v1/dashboard/top-routes');
            console.log('');
            console.log('--- PDF Y WALLET (10 pts) ---');
            console.log('  GET  /api/v1/boarding-pass/pdf?ticket=');
            console.log('  GET  /api/v1/boarding-pass/wallet?ticket=');
            console.log('');
        });
        
    } catch (error) {
        console.error('[Fatal] Error starting server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;