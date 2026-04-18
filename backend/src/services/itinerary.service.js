const pool = require('../config/database/postgres');
const SeatState = require('../models/mongodb/SeatState.model');
const { redisClient } = require('../config/database/redis');

class ItineraryService {
    constructor(bookingService) {
        this.bookingService = bookingService;
    }

    normalizeCode(code) {
        return String(code || '').trim().toUpperCase();
    }

    async findFlightForSegment(segment) {
        const origin = this.normalizeCode(segment.origin);
        const destination = this.normalizeCode(segment.destination);
        const startDate = segment.startDate || null;
        const endDate = segment.endDate || null;
        const preferredFlightId = segment.preferredFlightId || null;

        if (!origin || !destination) {
            throw new Error('Cada tramo debe incluir origin y destination');
        }

        // 1. Intentar por flightId preferido
        if (preferredFlightId) {
            const byId = await pool.query(
                `SELECT *
                 FROM flights
                 WHERE id = $1
                   AND origin_code = $2
                   AND destination_code = $3
                   AND status <> 'CANCELLED'
                 LIMIT 1`,
                [preferredFlightId, origin, destination]
            );

            if (byId.rows.length > 0) {
                return byId.rows[0];
            }
        }

        // 2. Intentar con fechas si existen
        const params = [origin, destination];
        let extraFilters = '';

        if (startDate) {
            params.push(startDate);
            extraFilters += ` AND departure_date >= $${params.length}`;
        }

        if (endDate) {
            params.push(endDate);
            extraFilters += ` AND departure_date <= $${params.length}`;
        }

        const exactResult = await pool.query(
            `SELECT *
             FROM flights
             WHERE origin_code = $1
               AND destination_code = $2
               AND status <> 'CANCELLED'
               ${extraFilters}
             ORDER BY
               departure_date ASC,
               departure_time ASC,
               economy_price ASC NULLS LAST
             LIMIT 1`,
            params
        );

        if (exactResult.rows.length > 0) {
            return exactResult.rows[0];
        }

        // 3. Fallback: buscar sin fechas
        const relaxedResult = await pool.query(
            `SELECT *
             FROM flights
             WHERE origin_code = $1
               AND destination_code = $2
               AND status <> 'CANCELLED'
             ORDER BY
               departure_date ASC,
               departure_time ASC,
               economy_price ASC NULLS LAST
             LIMIT 1`,
            [origin, destination]
        );

        if (relaxedResult.rows.length > 0) {
            return relaxedResult.rows[0];
        }

        return null;
    }

    async quoteItinerary(itineraryData) {
        const { segments = [], classType = 'ECONOMY' } = itineraryData;

        if (!Array.isArray(segments) || segments.length === 0) {
            throw new Error('Debes enviar al menos un tramo');
        }

        const resolvedSegments = [];
        let totalPrice = 0;
        const errors = [];

        for (const segment of segments) {
            const flight = await this.findFlightForSegment(segment);

            if (!flight) {
                errors.push({
                    segment: `${this.normalizeCode(segment.origin)} → ${this.normalizeCode(segment.destination)}`,
                    error: 'No se encontró vuelo disponible'
                });
                continue;
            }

            const segmentPrice =
                classType === 'FIRST'
                    ? Number(flight.first_class_price || 0)
                    : Number(flight.economy_price || 0);

            resolvedSegments.push({
                flightId: flight.id,
                flightNumber: flight.flight_number,
                origin: flight.origin_code,
                destination: flight.destination_code,
                departureDate: flight.departure_date,
                departureTime: flight.departure_time,
                gate: flight.gate,
                classType,
                price: segmentPrice
            });

            totalPrice += segmentPrice;
        }

        // Si hay errores, devolver información detallada
        if (errors.length > 0) {
            const errorMessage = errors.map(e => `${e.segment}: ${e.error}`).join('; ');
            throw new Error(`No se pudo cotizar el itinerario: ${errorMessage}`);
        }

        return {
            success: true,
            segments: resolvedSegments,
            totalSegments: resolvedSegments.length,
            totalPrice
        };
    }

    async reserveItinerary(itineraryData) {
        const {
            passengerId,
            classType = 'ECONOMY',
            segments = []
        } = itineraryData;

        if (!passengerId) {
            throw new Error('passengerId es requerido');
        }

        if (!Array.isArray(segments) || segments.length === 0) {
            throw new Error('Debes enviar al menos un tramo');
        }

        const reservedSegments = [];

        try {
            for (const segment of segments) {
                const flight = await this.findFlightForSegment(segment);

                if (!flight) {
                    throw new Error(
                        `No se encontró vuelo para el tramo ${this.normalizeCode(segment.origin)} -> ${this.normalizeCode(segment.destination)}`
                    );
                }

                if (!segment.seatNumber) {
                    throw new Error(
                        `Falta seatNumber para el tramo ${this.normalizeCode(segment.origin)} -> ${this.normalizeCode(segment.destination)}`
                    );
                }

                const reserveResult = await this.bookingService.reserveSeat(
                    Number(flight.id),
                    segment.seatNumber,
                    Number(passengerId),
                    classType
                );

                if (!reserveResult.success) {
                    throw new Error(
                        reserveResult.error ||
                        `No se pudo reservar el tramo ${flight.origin_code} -> ${flight.destination_code}`
                    );
                }

                reservedSegments.push({
                    flightId: flight.id,
                    flightNumber: flight.flight_number,
                    origin: flight.origin_code,
                    destination: flight.destination_code,
                    seatNumber: segment.seatNumber,
                    classType,
                    expiresAt: reserveResult.expiresAt || null
                });
            }

            return {
                success: true,
                message: 'Itinerario reservado correctamente',
                segments: reservedSegments
            };
        } catch (error) {
            await this.rollbackReservations(reservedSegments);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async buyItinerary(itineraryData) {
        const {
            passengerId,
            classType = 'ECONOMY',
            segments = []
        } = itineraryData;

        if (!passengerId) {
            throw new Error('passengerId es requerido');
        }

        if (!Array.isArray(segments) || segments.length === 0) {
            throw new Error('Debes enviar al menos un tramo');
        }

        const purchasedSegments = [];
        let totalPaid = 0;

        try {
            for (const segment of segments) {
                const flight = await this.findFlightForSegment(segment);

                if (!flight) {
                    throw new Error(
                        `No se encontró vuelo para el tramo ${this.normalizeCode(segment.origin)} -> ${this.normalizeCode(segment.destination)}`
                    );
                }

                if (!segment.seatNumber) {
                    throw new Error(
                        `Falta seatNumber para el tramo ${this.normalizeCode(segment.origin)} -> ${this.normalizeCode(segment.destination)}`
                    );
                }

                const price =
                    classType === 'FIRST'
                        ? Number(flight.first_class_price || 0)
                        : Number(flight.economy_price || 0);

                const sellResult = await this.bookingService.sellSeat(
                    Number(flight.id),
                    segment.seatNumber,
                    Number(passengerId),
                    classType,
                    price
                );

                if (!sellResult.success) {
                    throw new Error(
                        sellResult.error ||
                        `No se pudo comprar el tramo ${flight.origin_code} -> ${flight.destination_code}`
                    );
                }

                purchasedSegments.push({
                    flightId: flight.id,
                    flightNumber: flight.flight_number,
                    origin: flight.origin_code,
                    destination: flight.destination_code,
                    seatNumber: segment.seatNumber,
                    classType,
                    price,
                    sale: sellResult.sale || null
                });

                totalPaid += price;
            }

            return {
                success: true,
                message: 'Itinerario comprado correctamente',
                totalPaid,
                segments: purchasedSegments
            };
        } catch (error) {
            await this.rollbackPurchases(purchasedSegments, passengerId);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async rollbackReservations(reservedSegments) {
        for (const segment of reservedSegments) {
            try {
                await SeatState.findOneAndUpdate(
                    {
                        flight_id: Number(segment.flightId),
                        seat_number: segment.seatNumber
                    },
                    {
                        status: 'AVAILABLE',
                        reservation_expires_at: null,
                        refund_timer_expires_at: null,
                        last_passenger_id: null,
                        last_updated: new Date(),
                        last_updated_by_node: this.bookingService?.nodeId || 1
                    },
                    { new: true }
                );

                const reservationKey = 'reservation:' + segment.flightId + ':' + segment.seatNumber;
                await redisClient.del(reservationKey);
            } catch (error) {
                console.error('[Itinerary] Error haciendo rollback de reserva:', error.message);
            }
        }
    }

    async rollbackPurchases(purchasedSegments, passengerId) {
        for (const segment of purchasedSegments.reverse()) {
            try {
                await this.bookingService.refundSeat(
                    Number(segment.flightId),
                    segment.seatNumber,
                    Number(passengerId)
                );
            } catch (error) {
                console.error('[Itinerary] Error haciendo rollback de compra:', error.message);
            }
        }
    }
}

module.exports = ItineraryService;