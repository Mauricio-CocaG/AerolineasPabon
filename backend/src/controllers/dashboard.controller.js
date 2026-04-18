/**
 * DASHBOARD GERENCIAL
 * Muestra estadísticas en tiempo real del sistema
 * Puntaje: 20 puntos
 */

const pool = require('../config/database/postgres');
const SeatState = require('../models/mongodb/SeatState.model');
const { redisClient } = require('../config/database/redis');

class DashboardController {
    constructor(syncService, nodeId, nodeName) {
        this.syncService = syncService;
        this.nodeId = nodeId;
        this.nodeName = nodeName;
    }

    /**
     * Obtener estadísticas completas del dashboard
     */
    async getDashboardStats(req, res) {
        try {
            const [
                salesStats,
                seatStats,
                flightStats,
                syncStatus,
                revenueByClass,
                recentActivity
            ] = await Promise.all([
                this.getSalesStats(),
                this.getSeatStats(),
                this.getFlightStats(),
                this.getSyncStatus(),
                this.getRevenueByClass(),
                this.getRecentActivity()
            ]);

            res.json({
                success: true,
                timestamp: new Date().toISOString(),
                nodeInfo: {
                    nodeId: this.nodeId,
                    nodeName: this.nodeName,
                    vectorClock: this.syncService ? this.syncService.getVectorClock() : null
                },
                sales: salesStats,
                seats: seatStats,
                flights: flightStats,
                sync: syncStatus,
                revenue: revenueByClass,
                recentActivity: recentActivity
            });
        } catch (error) {
            console.error('[Dashboard] Error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Estadísticas de ventas
     */
    async getSalesStats() {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_sales,
                COUNT(DISTINCT passenger_id) as unique_passengers,
                COALESCE(SUM(price_paid), 0) as total_revenue,
                COALESCE(AVG(price_paid), 0) as average_ticket_price,
                COALESCE(MIN(price_paid), 0) as min_ticket,
                COALESCE(MAX(price_paid), 0) as max_ticket,
                COUNT(CASE WHEN class_type = 'FIRST' THEN 1 END) as first_class_sales,
                COUNT(CASE WHEN class_type = 'ECONOMY' THEN 1 END) as economy_sales
            FROM sales
            WHERE payment_status = 'COMPLETED'
        `);

        const dailySales = await pool.query(`
            SELECT 
                DATE(sale_date) as date,
                COUNT(*) as count,
                COALESCE(SUM(price_paid), 0) as revenue
            FROM sales
            WHERE sale_date >= NOW() - INTERVAL '7 days'
              AND payment_status = 'COMPLETED'
            GROUP BY DATE(sale_date)
            ORDER BY date DESC
        `);

        const row = result.rows[0];

        return {
            total_sales: parseInt(row.total_sales || 0),
            unique_passengers: parseInt(row.unique_passengers || 0),
            total_revenue: parseFloat(row.total_revenue || 0),
            average_ticket_price: parseFloat(row.average_ticket_price || 0),
            min_ticket: parseFloat(row.min_ticket || 0),
            max_ticket: parseFloat(row.max_ticket || 0),
            first_class_sales: parseInt(row.first_class_sales || 0),
            economy_sales: parseInt(row.economy_sales || 0),
            daily_sales: dailySales.rows.map(item => ({
                date: item.date,
                count: parseInt(item.count || 0),
                revenue: parseFloat(item.revenue || 0)
            })),
            total_revenue_formatted: this.formatCurrency(row.total_revenue || 0)
        };
    }

    /**
     * Estadísticas de asientos (desde MongoDB)
     */
    async getSeatStats() {
        const stats = await SeatState.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        const result = {
            total: 0,
            available: 0,
            reserved: 0,
            sold: 0,
            refunded: 0
        };

        stats.forEach(stat => {
            const key = String(stat._id || '').toLowerCase();
            if (result[key] !== undefined) {
                result[key] = stat.count;
            }
            result.total += stat.count;
        });

        result.available_percentage = result.total > 0 ? ((result.available / result.total) * 100).toFixed(1) : '0.0';
        result.sold_percentage = result.total > 0 ? ((result.sold / result.total) * 100).toFixed(1) : '0.0';
        result.reserved_percentage = result.total > 0 ? ((result.reserved / result.total) * 100).toFixed(1) : '0.0';
        result.refunded_percentage = result.total > 0 ? ((result.refunded / result.total) * 100).toFixed(1) : '0.0';

        return result;
    }

    /**
     * Estadísticas de vuelos
     */
    async getFlightStats() {
        const result = await pool.query(`
            SELECT 
                COUNT(*) as total_flights,
                COUNT(CASE WHEN status = 'SCHEDULED' THEN 1 END) as scheduled,
                COUNT(CASE WHEN status = 'BOARDING' THEN 1 END) as boarding,
                COUNT(CASE WHEN status = 'DELAYED' THEN 1 END) as delayed,
                COUNT(CASE WHEN status = 'DEPARTED' THEN 1 END) as departed,
                COUNT(CASE WHEN status = 'IN_FLIGHT' THEN 1 END) as in_flight,
                COUNT(CASE WHEN status = 'LANDED' THEN 1 END) as landed,
                COUNT(CASE WHEN status = 'ARRIVED' THEN 1 END) as arrived,
                COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelled,
                COUNT(CASE WHEN departure_date >= CURRENT_DATE THEN 1 END) as upcoming,
                COUNT(CASE WHEN departure_date < CURRENT_DATE THEN 1 END) as past
            FROM flights
        `);

        const nextFlights = await pool.query(`
            SELECT 
                flight_number,
                origin_code,
                destination_code,
                departure_date,
                departure_time,
                gate,
                status
            FROM flights
            WHERE departure_date = CURRENT_DATE
              AND departure_time > CURRENT_TIME
            ORDER BY departure_time ASC
            LIMIT 10
        `);

        const row = result.rows[0];
        const scheduled = parseInt(row.scheduled || 0);
        const delayed = parseInt(row.delayed || 0);
        const totalConsidered = scheduled + delayed;

        return {
            total_flights: parseInt(row.total_flights || 0),
            scheduled: scheduled,
            boarding: parseInt(row.boarding || 0),
            delayed: delayed,
            departed: parseInt(row.departed || 0),
            in_flight: parseInt(row.in_flight || 0),
            landed: parseInt(row.landed || 0),
            arrived: parseInt(row.arrived || 0),
            cancelled: parseInt(row.cancelled || 0),
            upcoming: parseInt(row.upcoming || 0),
            past: parseInt(row.past || 0),
            next_flights: nextFlights.rows,
            on_time_performance: totalConsidered > 0
                ? ((scheduled / totalConsidered) * 100).toFixed(1)
                : '100.0'
        };
    }

    /**
     * Estado de sincronización entre nodos
     */
    async getSyncStatus() {
        if (!this.syncService) {
            return {
                mode: 'STANDALONE',
                message: 'Modo independiente - Sin sincronización distribuida'
            };
        }

        const vectorClock = this.syncService.getVectorClock();

        let lastSync = null;
        let lastSyncTime = null;
        let latencyMs = null;
        let isHealthy = true;

        try {
            lastSync = await redisClient.get('last_sync_timestamp');
        } catch (error) {
            console.error('[Dashboard] Error leyendo last_sync_timestamp:', error.message);
        }

        if (lastSync) {
            lastSyncTime = new Date(lastSync);
            latencyMs = new Date() - lastSyncTime;
            isHealthy = latencyMs < 10000;
        }

        return {
            mode: 'DISTRIBUIDO',
            node_id: this.nodeId,
            node_name: this.nodeName,
            vector_clock: vectorClock,
            last_sync: lastSyncTime,
            latency_ms: latencyMs,
            is_healthy: isHealthy,
            message: lastSyncTime
                ? (isHealthy ? 'Sincronización OK' : 'Latencia alta - Revisar conexiones')
                : 'Sin dato reciente de sincronización'
        };
    }

    /**
     * Ingresos por clase
     */
    async getRevenueByClass() {
        const result = await pool.query(`
            SELECT 
                class_type,
                COUNT(*) as tickets_sold,
                COALESCE(SUM(price_paid), 0) as total_revenue,
                COALESCE(AVG(price_paid), 0) as average_price
            FROM sales
            WHERE payment_status = 'COMPLETED'
            GROUP BY class_type
        `);

        const firstClass = result.rows.find(r => r.class_type === 'FIRST') || {
            tickets_sold: 0,
            total_revenue: 0,
            average_price: 0
        };

        const economy = result.rows.find(r => r.class_type === 'ECONOMY') || {
            tickets_sold: 0,
            total_revenue: 0,
            average_price: 0
        };

        const firstRevenue = parseFloat(firstClass.total_revenue || 0);
        const economyRevenue = parseFloat(economy.total_revenue || 0);
        const total = firstRevenue + economyRevenue;

        return {
            first_class: {
                tickets_sold: parseInt(firstClass.tickets_sold || 0),
                total_revenue: firstRevenue,
                average_price: parseFloat(firstClass.average_price || 0),
                percentage_of_total: total > 0 ? ((firstRevenue / total) * 100).toFixed(1) : '0.0'
            },
            economy: {
                tickets_sold: parseInt(economy.tickets_sold || 0),
                total_revenue: economyRevenue,
                average_price: parseFloat(economy.average_price || 0),
                percentage_of_total: total > 0 ? ((economyRevenue / total) * 100).toFixed(1) : '0.0'
            },
            total_revenue: total,
            total_revenue_formatted: this.formatCurrency(total)
        };
    }

    /**
     * Actividad reciente (últimas 10 transacciones)
     */
    async getRecentActivity() {
        const recentSales = await pool.query(`
            SELECT 
                s.id,
                s.ticket_number,
                s.seat_number,
                s.class_type,
                s.price_paid,
                s.sale_date,
                f.flight_number,
                f.origin_code,
                f.destination_code,
                p.first_name,
                p.last_name
            FROM sales s
            JOIN flights f ON s.flight_id = f.id
            JOIN passengers p ON s.passenger_id = p.id
            WHERE s.payment_status = 'COMPLETED'
            ORDER BY s.sale_date DESC
            LIMIT 10
        `);

        return recentSales.rows.map(sale => ({
            ...sale,
            passenger_name: `${sale.first_name} ${sale.last_name}`,
            sale_date_formatted: new Date(sale.sale_date).toLocaleString(),
            price_formatted: this.formatCurrency(sale.price_paid)
        }));
    }

    /**
     * Formatear moneda
     */
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(Number(amount) || 0);
    }

    /**
     * Obtener ocupación por vuelo
     */
    async getFlightOccupancy(req, res) {
        const { flightId } = req.params;

        try {
            const flightResult = await pool.query(`
                SELECT 
                    f.id,
                    f.flight_number,
                    f.aircraft_id,
                    a.first_class_seats,
                    a.economy_seats
                FROM flights f
                LEFT JOIN aircrafts a ON f.aircraft_id = a.id
                WHERE f.id = $1
                LIMIT 1
            `, [parseInt(flightId)]);

            if (flightResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Vuelo no encontrado' });
            }

            const flight = flightResult.rows[0];
            const totalSeats = parseInt(flight.first_class_seats || 0) + parseInt(flight.economy_seats || 0);

            const soldSeats = await SeatState.countDocuments({
                flight_id: parseInt(flightId),
                status: 'SOLD'
            });

            const reservedSeats = await SeatState.countDocuments({
                flight_id: parseInt(flightId),
                status: 'RESERVED'
            });

            const refundedSeats = await SeatState.countDocuments({
                flight_id: parseInt(flightId),
                status: 'REFUNDED'
            });

            const availableSeats = Math.max(totalSeats - soldSeats - reservedSeats - refundedSeats, 0);
            const occupancyRate = totalSeats > 0 ? ((soldSeats / totalSeats) * 100).toFixed(1) : '0.0';

            res.json({
                success: true,
                flight_id: parseInt(flightId),
                flight_number: flight.flight_number,
                total_seats: totalSeats,
                sold: soldSeats,
                reserved: reservedSeats,
                refunded: refundedSeats,
                available: availableSeats,
                occupancy_rate: occupancyRate + '%'
            });
        } catch (error) {
            console.error('[Dashboard] Error occupancy:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }

    /**
     * Obtener top rutas más populares
     */
    async getTopRoutes(req, res) {
        try {
            const result = await pool.query(`
                SELECT 
                    f.origin_code,
                    f.destination_code,
                    COUNT(DISTINCT f.id) as total_flights,
                    COALESCE(SUM(s.price_paid), 0) as total_revenue,
                    COUNT(s.id) as tickets_sold
                FROM flights f
                JOIN sales s ON f.id = s.flight_id
                WHERE s.payment_status = 'COMPLETED'
                GROUP BY f.origin_code, f.destination_code
                ORDER BY total_revenue DESC
                LIMIT 10
            `);

            res.json({
                success: true,
                routes: result.rows.map(route => ({
                    origin_code: route.origin_code,
                    destination_code: route.destination_code,
                    total_flights: parseInt(route.total_flights || 0),
                    total_revenue: parseFloat(route.total_revenue || 0),
                    total_revenue_formatted: this.formatCurrency(route.total_revenue || 0),
                    tickets_sold: parseInt(route.tickets_sold || 0)
                }))
            });
        } catch (error) {
            console.error('[Dashboard] Error top routes:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = DashboardController;