const VectorClock = require('./vector-clock.service');
const pool = require('../config/database/postgres');
const SeatState = require('../models/mongodb/SeatState.model');
const { redisClient } = require('../config/database/redis');

class BookingService {
    constructor(nodeId, nodeName, syncService) {
        this.nodeId = nodeId;
        this.nodeName = nodeName;
        this.syncService = syncService;
        this.vectorClock = new VectorClock(nodeId, 3);
        this.registerSyncHandlers();
    }
    
    registerSyncHandlers() {
        if (!this.syncService) return;
        
        var self = this;
        
        this.syncService.on('SEAT_RESERVED', async function(data, senderNodeId) {
            await self.handleRemoteReservation(data, senderNodeId);
        });
        
        this.syncService.on('SEAT_SOLD', async function(data, senderNodeId) {
            await self.handleRemoteSale(data, senderNodeId);
        });
        
        this.syncService.on('SEAT_REFUNDED', async function(data, senderNodeId) {
            await self.handleRemoteRefund(data, senderNodeId);
        });
    }
    
    // VALIDACIÓN DE 72 HORAS - DESHABILITADA
    async validateSeventyTwoHours(flightId) {
        // Deshabilitado para pruebas - permite reservar cualquier vuelo
        return { valid: true };
    }
    
    async checkAvailability(flightId, seatNumber) {
        try {
            const seat = await SeatState.findOne({ flight_id: flightId, seat_number: seatNumber });
            
            if (!seat) {
                return { available: true, status: 'AVAILABLE' };
            }
            
            if (seat.status === 'REFUNDED' && seat.refund_timer_expires_at) {
                if (new Date() > seat.refund_timer_expires_at) {
                    await this.releaseSeatAfterCatering(flightId, seatNumber);
                    return { available: true, status: 'AVAILABLE' };
                }
                return { available: false, status: 'REFUNDED', expiresAt: seat.refund_timer_expires_at };
            }
            
            return { 
                available: seat.status === 'AVAILABLE', 
                status: seat.status,
                currentClock: seat.vector_clock
            };
        } catch (error) {
            console.error('[Booking] Error checking availability:', error);
            return { available: false, error: error.message };
        }
    }
    
    async reserveSeat(flightId, seatNumber, passengerId, classType) {
        try {
            // Validación de 72 horas (deshabilitada)
            const validation = await this.validateSeventyTwoHours(flightId);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }
            
            const availability = await this.checkAvailability(flightId, seatNumber);
            if (!availability.available) {
                return {
                    success: false,
                    error: 'Asiento ' + seatNumber + ' no disponible. Estado actual: ' + availability.status
                };
            }
            
            const lockKey = 'lock:' + flightId + ':' + seatNumber;
            const lockAcquired = await redisClient.setNX(lockKey, String(this.nodeId));
            if (!lockAcquired) {
                return { success: false, error: 'Asiento esta siendo procesado por otro nodo' };
            }
            
            this.vectorClock.increment();
            const currentClock = this.vectorClock.getClock();
            
            const seatState = await SeatState.findOneAndUpdate(
                { flight_id: flightId, seat_number: seatNumber },
                {
                    flight_id: flightId,
                    seat_number: seatNumber,
                    seat_class: classType,
                    status: 'RESERVED',
                    vector_clock: currentClock,
                    last_passenger_id: passengerId,
                    last_updated: new Date(),
                    last_updated_by_node: this.nodeId
                },
                { upsert: true, new: true }
            );
            
            if (this.syncService) {
                await this.syncService.broadcast('SEAT_RESERVED', {
                    flightId: flightId,
                    seatNumber: seatNumber,
                    passengerId: passengerId,
                    classType: classType,
                    vectorClock: currentClock,
                    nodeId: this.nodeId
                });
            }
            
            await redisClient.del(lockKey);
            
            console.log('[Booking] Asiento ' + seatNumber + ' reservado por nodo ' + this.nodeId);
            
            return {
                success: true,
                seat: seatState,
                vectorClock: currentClock,
                message: 'Asiento ' + seatNumber + ' reservado.'
            };
            
        } catch (error) {
            console.error('[Booking] Error:', error);
            return { success: false, error: error.message };
        }
    }
    
    async sellSeat(flightId, seatNumber, passengerId, classType, price) {
        try {
            const seat = await SeatState.findOne({ flight_id: flightId, seat_number: seatNumber });
            
            if (!seat || seat.status === 'SOLD') {
                return { success: false, error: 'Asiento ya esta vendido' };
            }
            
            if (seat.status === 'REFUNDED') {
                return { success: false, error: 'Asiento en proceso de devolucion. Espera 5 minutos.' };
            }
            
            const lockKey = 'lock:' + flightId + ':' + seatNumber;
            const lockAcquired = await redisClient.setNX(lockKey, String(this.nodeId));
            if (!lockAcquired) {
                return { success: false, error: 'Asiento esta siendo procesado' };
            }
            
            this.vectorClock.increment();
            const currentClock = this.vectorClock.getClock();
            
            const updatedSeat = await SeatState.findOneAndUpdate(
                { flight_id: flightId, seat_number: seatNumber },
                {
                    status: 'SOLD',
                    vector_clock: currentClock,
                    last_passenger_id: passengerId,
                    last_updated: new Date(),
                    last_updated_by_node: this.nodeId
                },
                { new: true }
            );
            
            const ticketNumber = 'RP' + Date.now() + Math.floor(Math.random() * 1000);
            const sale = await pool.query(
                'INSERT INTO sales (ticket_number, flight_id, passenger_id, seat_number, class_type, price_paid, vector_clock_snapshot, payment_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                [ticketNumber, flightId, passengerId, seatNumber, classType, price, JSON.stringify(currentClock), 'COMPLETED']
            );
            
            if (this.syncService) {
                await this.syncService.broadcast('SEAT_SOLD', {
                    flightId: flightId,
                    seatNumber: seatNumber,
                    passengerId: passengerId,
                    classType: classType,
                    price: price,
                    vectorClock: currentClock,
                    nodeId: this.nodeId
                });
            }
            
            await redisClient.del(lockKey);
            
            console.log('[Booking] Asiento ' + seatNumber + ' VENDIDO por nodo ' + this.nodeId);
            
            return {
                success: true,
                seat: updatedSeat,
                sale: sale.rows[0],
                vectorClock: currentClock,
                message: 'Compra exitosa! Asiento ' + seatNumber + ' confirmado.'
            };
            
        } catch (error) {
            console.error('[Booking] Error:', error);
            return { success: false, error: error.message };
        }
    }
    
    async refundSeat(flightId, seatNumber, passengerId) {
        try {
            const seat = await SeatState.findOne({ flight_id: flightId, seat_number: seatNumber });
            
            if (!seat || seat.status !== 'SOLD') {
                return { success: false, error: 'Solo se pueden devolver asientos vendidos' };
            }
            
            const lockKey = 'lock:' + flightId + ':' + seatNumber;
            const lockAcquired = await redisClient.setNX(lockKey, String(this.nodeId));
            if (!lockAcquired) {
                return { success: false, error: 'Asiento esta siendo procesado' };
            }
            
            this.vectorClock.increment();
            const currentClock = this.vectorClock.getClock();
            
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 5);
            
            const updatedSeat = await SeatState.findOneAndUpdate(
                { flight_id: flightId, seat_number: seatNumber },
                {
                    status: 'REFUNDED',
                    refund_timer_expires_at: expiresAt,
                    vector_clock: currentClock,
                    last_updated: new Date(),
                    last_updated_by_node: this.nodeId
                },
                { new: true }
            );
            
            await redisClient.setEx('catering:' + flightId + ':' + seatNumber, 300, JSON.stringify({ flightId: flightId, seatNumber: seatNumber, expiresAt: expiresAt.toISOString() }));
            
            var self = this;
            setTimeout(async function() {
                await self.releaseSeatAfterCatering(flightId, seatNumber);
            }, 300000);
            
            if (this.syncService) {
                await this.syncService.broadcast('SEAT_REFUNDED', {
                    flightId: flightId,
                    seatNumber: seatNumber,
                    passengerId: passengerId,
                    vectorClock: currentClock,
                    expiresAt: expiresAt.toISOString(),
                    nodeId: this.nodeId
                });
            }
            
            await redisClient.del(lockKey);
            
            console.log('[Booking] Asiento ' + seatNumber + ' DEVUELTO. Disponible en 5 minutos');
            
            return {
                success: true,
                seat: updatedSeat,
                vectorClock: currentClock,
                availableAt: expiresAt,
                message: 'Devolucion procesada. El asiento estara disponible en 5 minutos.'
            };
            
        } catch (error) {
            console.error('[Booking] Error:', error);
            return { success: false, error: error.message };
        }
    }
    
    async releaseSeatAfterCatering(flightId, seatNumber) {
        try {
            const seat = await SeatState.findOne({ flight_id: flightId, seat_number: seatNumber });
            
            if (!seat || seat.status !== 'REFUNDED') {
                return;
            }
            
            this.vectorClock.increment();
            const currentClock = this.vectorClock.getClock();
            
            await SeatState.findOneAndUpdate(
                { flight_id: flightId, seat_number: seatNumber },
                {
                    status: 'AVAILABLE',
                    refund_timer_expires_at: null,
                    vector_clock: currentClock,
                    last_passenger_id: null,
                    last_updated: new Date(),
                    last_updated_by_node: this.nodeId
                }
            );
            
            await redisClient.del('catering:' + flightId + ':' + seatNumber);
            
            if (this.syncService) {
                await this.syncService.broadcast('SEAT_AVAILABLE', {
                    flightId: flightId,
                    seatNumber: seatNumber,
                    vectorClock: currentClock,
                    nodeId: this.nodeId
                });
            }
            
            console.log('[Booking] Asiento ' + seatNumber + ' ahora esta LIBRE');
            
        } catch (error) {
            console.error('[Booking] Error:', error);
        }
    }
    
    async handleRemoteReservation(data, senderNodeId) {
        const { flightId, seatNumber, passengerId, classType, vectorClock } = data;
        
        await SeatState.findOneAndUpdate(
            { flight_id: flightId, seat_number: seatNumber },
            {
                status: 'RESERVED',
                vector_clock: vectorClock,
                last_passenger_id: passengerId,
                last_updated: new Date(),
                last_updated_by_node: senderNodeId
            },
            { upsert: true }
        );
        
        console.log('[Booking] Sincronizado: Asiento ' + seatNumber + ' reservado por nodo ' + senderNodeId);
    }
    
    async handleRemoteSale(data, senderNodeId) {
        const { flightId, seatNumber, passengerId, classType, price, vectorClock } = data;
        
        await SeatState.findOneAndUpdate(
            { flight_id: flightId, seat_number: seatNumber },
            {
                status: 'SOLD',
                vector_clock: vectorClock,
                last_passenger_id: passengerId,
                last_updated: new Date(),
                last_updated_by_node: senderNodeId
            },
            { upsert: true }
        );
        
        console.log('[Booking] Sincronizado: Asiento ' + seatNumber + ' VENDIDO por nodo ' + senderNodeId);
    }
    
    async handleRemoteRefund(data, senderNodeId) {
        const { flightId, seatNumber, passengerId, vectorClock, expiresAt } = data;
        
        await SeatState.findOneAndUpdate(
            { flight_id: flightId, seat_number: seatNumber },
            {
                status: 'REFUNDED',
                refund_timer_expires_at: new Date(expiresAt),
                vector_clock: vectorClock,
                last_updated: new Date(),
                last_updated_by_node: senderNodeId
            },
            { upsert: true }
        );
        
        console.log('[Booking] Sincronizado: Asiento ' + seatNumber + ' DEVUELTO por nodo ' + senderNodeId);
    }
}

module.exports = BookingService;
