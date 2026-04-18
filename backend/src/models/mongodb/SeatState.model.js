const mongoose = require('mongoose');

const seatStateSchema = new mongoose.Schema({
    flight_id: { type: Number, required: true },
    flight_number: { type: String, required: true },
    seat_number: { type: String, required: true },
    seat_class: { type: String, enum: ['FIRST', 'ECONOMY'], required: true },
    status: { type: String, enum: ['AVAILABLE', 'RESERVED', 'SOLD', 'REFUNDED'], default: 'AVAILABLE' },
    refund_timer_expires_at: { type: Date, default: null },
    vector_clock: {
        node_1: { type: Number, default: 0 },
        node_2: { type: Number, default: 0 },
        node_3: { type: Number, default: 0 }
    },
    reservation_expires_at: { type: Date, default: null },
    last_passenger_id: { type: Number, default: null },
    last_updated: { type: Date, default: Date.now },
    last_updated_by_node: { type: Number, required: true }
});

seatStateSchema.index({ flight_id: 1, seat_number: 1 }, { unique: true });
seatStateSchema.index({ status: 1 });
seatStateSchema.index({ refund_timer_expires_at: 1 });

module.exports = mongoose.model('SeatState', seatStateSchema);
