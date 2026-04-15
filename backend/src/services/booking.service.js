const VectorClock = require('./vector-clock.service');
const pool = require('../config/database/postgres');
const SeatState = require('../models/mongodb/SeatState.model');
const { redisClient } = require('../config/database/redis');

class BookingService {
    constructor(nodeId, nodeName, syncService) {
        this.nodeId = Number(nodeId);
        this.nodeName = nodeName;
        this.syncService = syncService;
        this.vectorClock = new VectorClock(this.nodeId, 3);

        this.refundTimerSeconds = Number(process.env.REFUND_TIMER_SECONDS || 900);
        this.refundTimerMs = this.refundTimerSeconds * 1000;
        this.processingLockSeconds = Number(process.env.SEAT_LOCK_SECONDS || 30);

        this.registerSyncHandlers();
    }

    registerSyncHandlers() {
        if (!this.syncService) return;

        const self = this;

        this.syncService.on('SEAT_RESERVED', async function (data, senderNodeId) {
            await self.handleRemoteReservation(data, senderNodeId);
        });

        this.syncService.on('SEAT_SOLD', async function (data, senderNodeId) {
            await self.handleRemoteSale(data, senderNodeId);
        });

        this.syncService.on('SEAT_REFUNDED', async function (data, senderNodeId) {
            await self.handleRemoteRefund(data, senderNodeId);
        });

        this.syncService.on('SEAT_AVAILABLE', async function (data, senderNodeId) {
            await self.handleRemoteAvailable(data, senderNodeId);
        });
    }

    getLockKey(flightId, seatNumber) {
        return 'lock:' + flightId + ':' + seatNumber;
    }

    getCateringKey(flightId, seatNumber) {
        return 'catering:' + flightId + ':' + seatNumber;
    }

    async acquireSeatLock(flightId, seatNumber) {
        const lockKey = this.getLockKey(flightId, seatNumber);
        const lockValue = String(this.nodeId) + ':' + String(Date.now());

        let lockAcquired = false;

        if (typeof redisClient.set === 'function') {
            const result = await redisClient.set(lockKey, lockValue, {
                NX: true,
                EX: this.processingLockSeconds
            });
            lockAcquired = result === 'OK';
        } else if (typeof redisClient.setNX === 'function') {
            lockAcquired = await redisClient.setNX(lockKey, lockValue);
            if (lockAcquired && typeof redisClient.expire === 'function') {
                await redisClient.expire(lockKey, this.processingLockSeconds);
            }
        }

        return {
            lockAcquired,
            lockKey,
            lockValue
        };
    }

    async releaseSeatLock(lockKey, lockValue) {
        try {
            if (!lockKey) return;

            if (typeof redisClient.get === 'function') {
                const currentValue = await redisClient.get(lockKey);
                if (currentValue === lockValue) {
                    await redisClient.del(lockKey);
                }
            } else {
                await redisClient.del(lockKey);
            }
        } catch (error) {
            console.error('[Booking] Error liberando lock:', error.message);
        }
    }

    async getFlightData(flightId) {
        const result = await pool.query(
            'SELECT id, flight_number, departure_date, departure_time, status FROM flights WHERE id = $1 LIMIT 1',
            [flightId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];
    }

    buildFlightDateTime(flightRow) {
        if (!flightRow || !flightRow.departure_date) {
            return null;
        }

        const flightDate = new Date(flightRow.departure_date);

        if (Number.isNaN(flightDate.getTime())) {
            return null;
        }

        if (flightRow.departure_time) {
            const timeString = String(flightRow.departure_time).trim();
            const match = timeString.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

            if (match) {
                const hours = Number(match[1] || 0);
                const minutes = Number(match[2] || 0);
                const seconds = Number(match[3] || 0);
                flightDate.setHours(hours, minutes, seconds, 0);
            }
        }

        return flightDate;
    }

    async validateSeventyTwoHours(flightId) {
        try {
            const flight = await this.getFlightData(flightId);

            if (!flight) {
                return { valid: false, error: 'Vuelo no encontrado' };
            }

            if (flight.status === 'CANCELLED') {
                return { valid: false, error: 'No se puede reservar un vuelo cancelado' };
            }

            const departureDate = this.buildFlightDateTime(flight);

            if (!departureDate) {
                return { valid: false, error: 'Fecha u hora del vuelo invalida' };
            }

            const now = new Date();
            const diffHours = (departureDate.getTime() - now.getTime()) / (1000 * 60 * 60);

            if (diffHours < 72) {
                return {
                    valid: false,
                    error: 'No se puede reservar un vuelo que sale en menos de 72 horas'
                };
            }

            return { valid: true };
        } catch (error) {
            console.error('[Booking] Error validando 72 horas:', error);
            return { valid: false, error: 'Error al validar la regla de 72 horas' };
        }
    }

    mergeRemoteVectorClock(remoteClock) {
        try {
            if (!remoteClock) {
                return this.vectorClock.getClock();
            }

            this.vectorClock.update(remoteClock);
            return this.vectorClock.getClock();
        } catch (error) {
            console.error('[Booking] Error actualizando vector clock:', error.message);
            return this.vectorClock.getClock();
        }
    }

    isRemoteEventStale(remoteClock, localClock, senderNodeId) {
        try {
            if (!remoteClock || !localClock) {
                return false;
            }

            const comparison = this.vectorClock.compare(remoteClock, localClock);

            if (comparison === -1) {
                return true;
            }

            if (comparison === 1) {
                return false;
            }

            if (
                typeof this.vectorClock.areConcurrent === 'function' &&
                this.vectorClock.areConcurrent(remoteClock, localClock)
            ) {
                const resolution = this.vectorClock.resolveConflict(
                    localClock,
                    remoteClock,
                    this.nodeId,
                    senderNodeId
                );

                return resolution.winner === 'local';
            }

            return false;
        } catch (error) {
            console.error('[Booking] Error comparando clocks:', error.message);
            return false;
        }
    }

    async checkAvailability(flightId, seatNumber) {
        try {
            const seat = await SeatState.findOne({ flight_id: flightId, seat_number: seatNumber });

            if (!seat) {
                return { available: true, status: 'AVAILABLE' };
            }

            if (seat.status === 'REFUNDED' && seat.refund_timer_expires_at) {
                if (new Date() > new Date(seat.refund_timer_expires_at)) {
                    await this.releaseSeatAfterCatering(flightId, seatNumber);
                    return { available: true, status: 'AVAILABLE' };
                }

                return {
                    available: false,
                    status: 'REFUNDED',
                    expiresAt: seat.refund_timer_expires_at
                };
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
        let lockInfo = null;

        try {
            const validation = await this.validateSeventyTwoHours(flightId);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            const flight = await this.getFlightData(flightId);
            if (!flight) {
                return { success: false, error: 'Vuelo no encontrado' };
            }

            const availability = await this.checkAvailability(flightId, seatNumber);
            if (!availability.available) {
                return {
                    success: false,
                    error: 'Asiento ' + seatNumber + ' no disponible. Estado actual: ' + availability.status
                };
            }

            lockInfo = await this.acquireSeatLock(flightId, seatNumber);
            if (!lockInfo.lockAcquired) {
                return { success: false, error: 'Asiento esta siendo procesado por otro nodo' };
            }

            this.vectorClock.increment();
            const currentClock = this.vectorClock.getClock();

            const seatState = await SeatState.findOneAndUpdate(
                { flight_id: flightId, seat_number: seatNumber },
                {
                    flight_id: flightId,
                    flight_number: flight.flight_number,
                    seat_number: seatNumber,
                    seat_class: classType,
                    status: 'RESERVED',
                    refund_timer_expires_at: null,
                    vector_clock: currentClock,
                    last_passenger_id: passengerId,
                    last_updated: new Date(),
                    last_updated_by_node: this.nodeId
                },
                { upsert: true, new: true, runValidators: true }
            );

            if (this.syncService) {
                await this.syncService.broadcast('SEAT_RESERVED', {
                    flightId: flightId,
                    flightNumber: flight.flight_number,
                    seatNumber: seatNumber,
                    passengerId: passengerId,
                    classType: classType,
                    vectorClock: currentClock,
                    nodeId: this.nodeId
                });
            }

            console.log('[Booking] Asiento ' + seatNumber + ' reservado por nodo ' + this.nodeId);

            return {
                success: true,
                seat: seatState,
                vectorClock: currentClock,
                message: 'Asiento ' + seatNumber + ' reservado.'
            };
        } catch (error) {
            console.error('[Booking] Error reservando asiento:', error);
            return { success: false, error: error.message };
        } finally {
            if (lockInfo && lockInfo.lockAcquired) {
                await this.releaseSeatLock(lockInfo.lockKey, lockInfo.lockValue);
            }
        }
    }

    async sellSeat(flightId, seatNumber, passengerId, classType, price) {
        let lockInfo = null;

        try {
            const flight = await this.getFlightData(flightId);
            if (!flight) {
                return { success: false, error: 'Vuelo no encontrado' };
            }

            const seat = await SeatState.findOne({ flight_id: flightId, seat_number: seatNumber });

            if (!seat) {
                return { success: false, error: 'Asiento no encontrado para este vuelo' };
            }

            if (seat.status === 'SOLD') {
                return { success: false, error: 'Asiento ya esta vendido' };
            }

            if (seat.status === 'REFUNDED') {
                return { success: false, error: 'Asiento en proceso de devolucion. Espera 15 minutos.' };
            }

            lockInfo = await this.acquireSeatLock(flightId, seatNumber);
            if (!lockInfo.lockAcquired) {
                return { success: false, error: 'Asiento esta siendo procesado' };
            }

            this.vectorClock.increment();
            const currentClock = this.vectorClock.getClock();

            const updatedSeat = await SeatState.findOneAndUpdate(
                { flight_id: flightId, seat_number: seatNumber },
                {
                    flight_id: flightId,
                    flight_number: flight.flight_number,
                    seat_number: seatNumber,
                    seat_class: classType,
                    status: 'SOLD',
                    refund_timer_expires_at: null,
                    vector_clock: currentClock,
                    last_passenger_id: passengerId,
                    last_updated: new Date(),
                    last_updated_by_node: this.nodeId
                },
                { new: true, runValidators: true }
            );

            const ticketNumber = 'RP' + Date.now() + Math.floor(Math.random() * 1000);

            const sale = await pool.query(
                'INSERT INTO sales (ticket_number, flight_id, passenger_id, seat_number, class_type, price_paid, vector_clock_snapshot, payment_status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
                [ticketNumber, flightId, passengerId, seatNumber, classType, price, JSON.stringify(currentClock), 'COMPLETED']
            );

            if (this.syncService) {
                await this.syncService.broadcast('SEAT_SOLD', {
                    flightId: flightId,
                    flightNumber: flight.flight_number,
                    seatNumber: seatNumber,
                    passengerId: passengerId,
                    classType: classType,
                    price: price,
                    vectorClock: currentClock,
                    nodeId: this.nodeId
                });
            }

            console.log('[Booking] Asiento ' + seatNumber + ' VENDIDO por nodo ' + this.nodeId);

            return {
                success: true,
                seat: updatedSeat,
                sale: sale.rows[0],
                vectorClock: currentClock,
                message: 'Compra exitosa. Asiento ' + seatNumber + ' confirmado.'
            };
        } catch (error) {
            console.error('[Booking] Error vendiendo asiento:', error);
            return { success: false, error: error.message };
        } finally {
            if (lockInfo && lockInfo.lockAcquired) {
                await this.releaseSeatLock(lockInfo.lockKey, lockInfo.lockValue);
            }
        }
    }

    async refundSeat(flightId, seatNumber, passengerId) {
        let lockInfo = null;

        try {
            const flight = await this.getFlightData(flightId);
            if (!flight) {
                return { success: false, error: 'Vuelo no encontrado' };
            }

            const seat = await SeatState.findOne({ flight_id: flightId, seat_number: seatNumber });

            if (!seat || seat.status !== 'SOLD') {
                return { success: false, error: 'Solo se pueden devolver asientos vendidos' };
            }

            lockInfo = await this.acquireSeatLock(flightId, seatNumber);
            if (!lockInfo.lockAcquired) {
                return { success: false, error: 'Asiento esta siendo procesado' };
            }

            this.vectorClock.increment();
            const currentClock = this.vectorClock.getClock();

            const expiresAt = new Date();
            expiresAt.setSeconds(expiresAt.getSeconds() + this.refundTimerSeconds);

            const updatedSeat = await SeatState.findOneAndUpdate(
                { flight_id: flightId, seat_number: seatNumber },
                {
                    flight_id: flightId,
                    flight_number: flight.flight_number,
                    seat_number: seatNumber,
                    seat_class: seat.seat_class,
                    status: 'REFUNDED',
                    refund_timer_expires_at: expiresAt,
                    vector_clock: currentClock,
                    last_passenger_id: passengerId,
                    last_updated: new Date(),
                    last_updated_by_node: this.nodeId
                },
                { new: true, runValidators: true }
            );

            await redisClient.setEx(
                this.getCateringKey(flightId, seatNumber),
                this.refundTimerSeconds,
                JSON.stringify({
                    flightId: flightId,
                    seatNumber: seatNumber,
                    expiresAt: expiresAt.toISOString()
                })
            );

            const self = this;
            setTimeout(async function () {
                await self.releaseSeatAfterCatering(flightId, seatNumber);
            }, this.refundTimerMs);

            if (this.syncService) {
                await this.syncService.broadcast('SEAT_REFUNDED', {
                    flightId: flightId,
                    flightNumber: flight.flight_number,
                    seatNumber: seatNumber,
                    passengerId: passengerId,
                    vectorClock: currentClock,
                    expiresAt: expiresAt.toISOString(),
                    nodeId: this.nodeId
                });
            }

            console.log('[Booking] Asiento ' + seatNumber + ' DEVUELTO. Disponible en 15 minutos');

            return {
                success: true,
                seat: updatedSeat,
                vectorClock: currentClock,
                availableAt: expiresAt,
                message: 'Devolucion procesada. El asiento estara disponible en 15 minutos.'
            };
        } catch (error) {
            console.error('[Booking] Error devolviendo asiento:', error);
            return { success: false, error: error.message };
        } finally {
            if (lockInfo && lockInfo.lockAcquired) {
                await this.releaseSeatLock(lockInfo.lockKey, lockInfo.lockValue);
            }
        }
    }

    async releaseSeatAfterCatering(flightId, seatNumber) {
        try {
            const seat = await SeatState.findOne({ flight_id: flightId, seat_number: seatNumber });

            if (!seat || seat.status !== 'REFUNDED') {
                return;
            }

            if (seat.refund_timer_expires_at && new Date() < new Date(seat.refund_timer_expires_at)) {
                return;
            }

            this.vectorClock.increment();
            const currentClock = this.vectorClock.getClock();

            await SeatState.findOneAndUpdate(
                { flight_id: flightId, seat_number: seatNumber },
                {
                    flight_id: seat.flight_id,
                    flight_number: seat.flight_number,
                    seat_number: seat.seat_number,
                    seat_class: seat.seat_class,
                    status: 'AVAILABLE',
                    refund_timer_expires_at: null,
                    vector_clock: currentClock,
                    last_passenger_id: null,
                    last_updated: new Date(),
                    last_updated_by_node: this.nodeId
                },
                { new: true, runValidators: true }
            );

            await redisClient.del(this.getCateringKey(flightId, seatNumber));

            if (this.syncService) {
                await this.syncService.broadcast('SEAT_AVAILABLE', {
                    flightId: flightId,
                    flightNumber: seat.flight_number,
                    seatNumber: seatNumber,
                    classType: seat.seat_class,
                    vectorClock: currentClock,
                    nodeId: this.nodeId
                });
            }

            console.log('[Booking] Asiento ' + seatNumber + ' ahora esta LIBRE');
        } catch (error) {
            console.error('[Booking] Error liberando asiento:', error);
        }
    }

    async handleRemoteReservation(data, senderNodeId) {
        try {
            const flightId = data.flightId;
            const flightNumber = data.flightNumber;
            const seatNumber = data.seatNumber;
            const passengerId = data.passengerId;
            const classType = data.classType;
            const vectorClock = data.vectorClock;

            const existingSeat = await SeatState.findOne({ flight_id: flightId, seat_number: seatNumber });

            if (existingSeat && existingSeat.vector_clock) {
                const isStale = this.isRemoteEventStale(vectorClock, existingSeat.vector_clock, senderNodeId);
                if (isStale) {
                    console.log('[Booking] Evento remoto reservado descartado por ser mas antiguo');
                    return;
                }
            }

            this.mergeRemoteVectorClock(vectorClock);

            await SeatState.findOneAndUpdate(
                { flight_id: flightId, seat_number: seatNumber },
                {
                    flight_id: flightId,
                    flight_number: flightNumber || (existingSeat ? existingSeat.flight_number : 'UNKNOWN'),
                    seat_number: seatNumber,
                    seat_class: classType,
                    status: 'RESERVED',
                    refund_timer_expires_at: null,
                    vector_clock: vectorClock,
                    last_passenger_id: passengerId,
                    last_updated: new Date(),
                    last_updated_by_node: senderNodeId
                },
                { upsert: true, runValidators: true }
            );

            console.log('[Booking] Sincronizado: Asiento ' + seatNumber + ' reservado por nodo ' + senderNodeId);
        } catch (error) {
            console.error('[Booking] Error sincronizando reserva remota:', error);
        }
    }

    async handleRemoteSale(data, senderNodeId) {
        try {
            const flightId = data.flightId;
            const flightNumber = data.flightNumber;
            const seatNumber = data.seatNumber;
            const passengerId = data.passengerId;
            const classType = data.classType;
            const vectorClock = data.vectorClock;

            const existingSeat = await SeatState.findOne({ flight_id: flightId, seat_number: seatNumber });

            if (existingSeat && existingSeat.vector_clock) {
                const isStale = this.isRemoteEventStale(vectorClock, existingSeat.vector_clock, senderNodeId);
                if (isStale) {
                    console.log('[Booking] Evento remoto vendido descartado por ser mas antiguo');
                    return;
                }
            }

            this.mergeRemoteVectorClock(vectorClock);

            await SeatState.findOneAndUpdate(
                { flight_id: flightId, seat_number: seatNumber },
                {
                    flight_id: flightId,
                    flight_number: flightNumber || (existingSeat ? existingSeat.flight_number : 'UNKNOWN'),
                    seat_number: seatNumber,
                    seat_class: classType || (existingSeat ? existingSeat.seat_class : 'ECONOMY'),
                    status: 'SOLD',
                    refund_timer_expires_at: null,
                    vector_clock: vectorClock,
                    last_passenger_id: passengerId,
                    last_updated: new Date(),
                    last_updated_by_node: senderNodeId
                },
                { upsert: true, runValidators: true }
            );

            console.log('[Booking] Sincronizado: Asiento ' + seatNumber + ' VENDIDO por nodo ' + senderNodeId);
        } catch (error) {
            console.error('[Booking] Error sincronizando venta remota:', error);
        }
    }

    async handleRemoteRefund(data, senderNodeId) {
        try {
            const flightId = data.flightId;
            const flightNumber = data.flightNumber;
            const seatNumber = data.seatNumber;
            const passengerId = data.passengerId;
            const vectorClock = data.vectorClock;
            const expiresAt = data.expiresAt;

            const existingSeat = await SeatState.findOne({ flight_id: flightId, seat_number: seatNumber });

            if (existingSeat && existingSeat.vector_clock) {
                const isStale = this.isRemoteEventStale(vectorClock, existingSeat.vector_clock, senderNodeId);
                if (isStale) {
                    console.log('[Booking] Evento remoto refund descartado por ser mas antiguo');
                    return;
                }
            }

            this.mergeRemoteVectorClock(vectorClock);

            await SeatState.findOneAndUpdate(
                { flight_id: flightId, seat_number: seatNumber },
                {
                    flight_id: flightId,
                    flight_number: flightNumber || (existingSeat ? existingSeat.flight_number : 'UNKNOWN'),
                    seat_number: seatNumber,
                    seat_class: existingSeat ? existingSeat.seat_class : 'ECONOMY',
                    status: 'REFUNDED',
                    refund_timer_expires_at: new Date(expiresAt),
                    vector_clock: vectorClock,
                    last_passenger_id: passengerId,
                    last_updated: new Date(),
                    last_updated_by_node: senderNodeId
                },
                { upsert: true, runValidators: true }
            );

            await redisClient.setEx(
                this.getCateringKey(flightId, seatNumber),
                this.refundTimerSeconds,
                JSON.stringify({
                    flightId: flightId,
                    seatNumber: seatNumber,
                    expiresAt: expiresAt
                })
            );

            console.log('[Booking] Sincronizado: Asiento ' + seatNumber + ' DEVUELTO por nodo ' + senderNodeId);
        } catch (error) {
            console.error('[Booking] Error sincronizando devolucion remota:', error);
        }
    }

    async handleRemoteAvailable(data, senderNodeId) {
        try {
            const flightId = data.flightId;
            const flightNumber = data.flightNumber;
            const seatNumber = data.seatNumber;
            const classType = data.classType;
            const vectorClock = data.vectorClock;

            const existingSeat = await SeatState.findOne({ flight_id: flightId, seat_number: seatNumber });

            if (existingSeat && existingSeat.vector_clock) {
                const isStale = this.isRemoteEventStale(vectorClock, existingSeat.vector_clock, senderNodeId);
                if (isStale) {
                    console.log('[Booking] Evento remoto available descartado por ser mas antiguo');
                    return;
                }
            }

            this.mergeRemoteVectorClock(vectorClock);

            await SeatState.findOneAndUpdate(
                { flight_id: flightId, seat_number: seatNumber },
                {
                    flight_id: flightId,
                    flight_number: flightNumber || (existingSeat ? existingSeat.flight_number : 'UNKNOWN'),
                    seat_number: seatNumber,
                    seat_class: classType || (existingSeat ? existingSeat.seat_class : 'ECONOMY'),
                    status: 'AVAILABLE',
                    refund_timer_expires_at: null,
                    vector_clock: vectorClock,
                    last_passenger_id: null,
                    last_updated: new Date(),
                    last_updated_by_node: senderNodeId
                },
                { upsert: true, runValidators: true }
            );

            await redisClient.del(this.getCateringKey(flightId, seatNumber));

            console.log('[Booking] Sincronizado: Asiento ' + seatNumber + ' LIBRE por nodo ' + senderNodeId);
        } catch (error) {
            console.error('[Booking] Error sincronizando disponibilidad remota:', error);
        }
    }
}

module.exports = BookingService;