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
                SUM(price_paid) as total_revenue,
                AVG(price_paid) as average_ticket_price,
                MIN(price_paid) as min_ticket,
                MAX(price_paid) as max_ticket,
                COUNT(CASE WHEN class_type = 'FIRST' THEN 1 END) as first_class_sales,
                COUNT(CASE WHEN class_type = 'ECONOMY' THEN 1 END) as economy_sales
            FROM sales
            WHERE payment_status = 'COMPLETED'
        `);
        
        // Ventas por día (últimos 7 días)
        const dailySales = await pool.query(`
            SELECT 
                DATE(sale_date) as date,
                COUNT(*) as count,
                SUM(price_paid) as revenue
            FROM sales
            WHERE sale_date >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(sale_date)
            ORDER BY date DESC
        `);

        return {
            ...result.rows[0],
            daily_sales: dailySales.rows,
            total_revenue_formatted: this.formatCurrency(result.rows[0].total_revenue || 0)
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

        const statusMap = {
            'AVAILABLE': 'libres',
            'RESERVED': 'reservados',
            'SOLD': 'vendidos',
            'REFUNDED': 'en_devolucion'
        };

        const result = {
            total: 0,
            available: 0,
            reserved: 0,
            sold: 0,
            refunded: 0
        };

        stats.forEach(stat => {
            const key = statusMap[stat._id] || stat._id.toLowerCase();
            result[key] = stat.count;
            result.total += stat.count;
        });

        // Porcentajes
        result.available_percentage = result.total > 0 ? ((result.available / result.total) * 100).toFixed(1) : 0;
        result.sold_percentage = result.total > 0 ? ((result.sold / result.total) * 100).toFixed(1) : 0;
        result.reserved_percentage = result.total > 0 ? ((result.reserved / result.total) * 100).toFixed(1) : 0;

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

        // Próximos vuelos (próximas 24 horas)
        const nextFlights = await pool.query(`
            SELECT 
                flight_number,
                origin_code,
                destination_code,
                departure_time,
                gate,
                status
            FROM flights
            WHERE departure_date = CURRENT_DATE 
                AND departure_time > CURRENT_TIME
            ORDER BY departure_time ASC
            LIMIT 10
        `);

        return {
            ...result.rows[0],
            next_flights: nextFlights.rows,
            on_time_performance: result.rows[0].scheduled > 0 
                ? ((result.rows[0].scheduled / (result.rows[0].scheduled + result.rows[0].delayed)) * 100).toFixed(1)
                : 100
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
        
        // Verificar latencia de sincronización (desde Redis)
        const lastSync = await redisClient.get('last_sync_timestamp');
        const lastSyncTime = lastSync ? new Date(lastSync) : null;
        const now = new Date();
        
        let latencyMs = null;
        let isHealthy = true;
        
        if (lastSyncTime) {
            latencyMs = now - lastSyncTime;
            isHealthy = latencyMs < 10000; // Menos de 10 segundos
        }

        return {
            mode: 'DISTRIBUIDO',
            node_id: this.nodeId,
            node_name: this.nodeName,
            vector_clock: vectorClock,
            last_sync: lastSyncTime,
            latency_ms: latencyMs,
            is_healthy: isHealthy,
            message: isHealthy ? 'Sincronización OK' : 'Latencia alta - Revisar conexiones'
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
                SUM(price_paid) as total_revenue,
                AVG(price_paid) as average_price
            FROM sales
            WHERE payment_status = 'COMPLETED'
            GROUP BY class_type
        `);

        const firstClass = result.rows.find(r => r.class_type === 'FIRST') || { tickets_sold: 0, total_revenue: 0, average_price: 0 };
        const economy = result.rows.find(r => r.class_type === 'ECONOMY') || { tickets_sold: 0, total_revenue: 0, average_price: 0 };
        const total = (firstClass.total_revenue || 0) + (economy.total_revenue || 0);

        return {
            first_class: {
                tickets_sold: parseInt(firstClass.tickets_sold),
                total_revenue: firstClass.total_revenue || 0,
                average_price: firstClass.average_price || 0,
                percentage_of_total: total > 0 ? ((firstClass.total_revenue / total) * 100).toFixed(1) : 0
            },
            economy: {
                tickets_sold: parseInt(economy.tickets_sold),
                total_revenue: economy.total_revenue || 0,
                average_price: economy.average_price || 0,
                percentage_of_total: total > 0 ? ((economy.total_revenue / total) * 100).toFixed(1) : 0
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
        }).format(amount);
    }

    /**
     * Obtener ocupación por vuelo
     */
    async getFlightOccupancy(req, res) {
        const { flightId } = req.params;

        try {
            const totalSeats = await SeatState.countDocuments({ flight_id: parseInt(flightId) });
            const soldSeats = await SeatState.countDocuments({ 
                flight_id: parseInt(flightId), 
                status: 'SOLD' 
            });
            const reservedSeats = await SeatState.countDocuments({ 
                flight_id: parseInt(flightId), 
                status: 'RESERVED' 
            });

            const occupancyRate = totalSeats > 0 ? ((soldSeats / totalSeats) * 100).toFixed(1) : 0;

            res.json({
                success: true,
                flight_id: flightId,
                total_seats: totalSeats,
                sold: soldSeats,
                reserved: reservedSeats,
                available: totalSeats - soldSeats - reservedSeats,
                occupancy_rate: occupancyRate + '%'
            });

        } catch (error) {
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
                    COUNT(*) as total_flights,
                    SUM(s.price_paid) as total_revenue,
                    COUNT(s.id) as tickets_sold
                FROM flights f
                JOIN sales s ON f.id = s.flight_id
                GROUP BY f.origin_code, f.destination_code
                ORDER BY total_revenue DESC
                LIMIT 10
            `);

            res.json({
                success: true,
                routes: result.rows
            });

        } catch (error) {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

module.exports = DashboardController;