require('dotenv').config();

module.exports = {
    // Node configuration
    nodeId: parseInt(process.env.NODE_ID) || 1,
    nodeName: process.env.NODE_NAME || 'BOGOTA',
    port: parseInt(process.env.PORT) || 3001,
    
    // Database configuration
    postgres: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT) || 5433,
        user: process.env.POSTGRES_USER || 'admin',
        password: process.env.POSTGRES_PASSWORD || 'secret',
        database: process.env.POSTGRES_DB || 'rafael_pabon',
    },
    
    mongodb: {
        url: process.env.MONGODB_URL || 'mongodb://localhost:27018/rafael_pabon',
    },
    
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6380,
    },
    
    rabbitmq: {
        url: process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5673',
    },
    
    // Business rules
    refundTimerSeconds: parseInt(process.env.REFUND_TIMER_SECONDS) || 300,
    syncMaxDelaySeconds: parseInt(process.env.SYNC_MAX_DELAY_SECONDS) || 10,
};