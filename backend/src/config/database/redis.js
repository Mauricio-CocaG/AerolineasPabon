const redis = require('redis');
const config = require('../env');
const redisClient = redis.createClient({
    socket: {
        host: config.redis.host,
        port: config.redis.port,
    }
});

redisClient.on('error', (err) => {
    console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
    console.log('Redis connected successfully on ' + config.redis.host + ':' + config.redis.port);
});

const connectRedis = async () => {
    try {
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
        return true;
    } catch (error) {
        console.error('Error connecting to Redis:', error.message);
        return false;
    }
};

module.exports = { redisClient, connectRedis };