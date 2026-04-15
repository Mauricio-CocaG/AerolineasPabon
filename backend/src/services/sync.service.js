const amqp = require('amqplib');
const VectorClock = require('./vector-clock.service');

class SyncService {
    constructor(nodeId, nodeName) {
        this.nodeId = nodeId;
        this.nodeName = nodeName;
        this.connection = null;
        this.channel = null;
        this.vectorClock = new VectorClock(nodeId, 3);
        this.exchangeName = 'rafael_pabon_exchange';
        this.queueName = 'node_' + nodeId + '_queue';
        this.handlers = new Map();
    }
    
    async connect() {
        try {
            const rabbitUrl = 'amqp://admin:admin@localhost:5672';
            this.connection = await amqp.connect(rabbitUrl);
            this.channel = await this.connection.createChannel();
            
            await this.channel.assertExchange(this.exchangeName, 'fanout', { durable: true });
            await this.channel.assertQueue(this.queueName, { durable: true });
            await this.channel.bindQueue(this.queueName, this.exchangeName, '');
            
            console.log('[Sync] Nodo ' + this.nodeId + ' conectado a RabbitMQ');
            
            this.consumeMessages();
            return true;
        } catch (error) {
            console.error('[Sync] Error conectando a RabbitMQ:', error.message);
            return false;
        }
    }
    
    async consumeMessages() {
        if (!this.channel) return;
        
        await this.channel.consume(this.queueName, (msg) => {
            if (msg) {
                this.processMessage(msg);
                this.channel.ack(msg);
            }
        });
    }
    
    async processMessage(msg) {
        try {
            const content = JSON.parse(msg.content.toString());
            const { type, data, senderNodeId, senderClock } = content;
            
            console.log('[Sync] Mensaje recibido tipo: ' + type + ' desde nodo ' + senderNodeId);
            
            const remoteClock = JSON.parse(senderClock);
            this.vectorClock.update(remoteClock);
            
            if (this.handlers.has(type)) {
                const handler = this.handlers.get(type);
                await handler(data, senderNodeId);
            }
        } catch (error) {
            console.error('[Sync] Error:', error);
        }
    }
    
    async broadcast(type, data) {
        if (!this.channel) return false;
        
        try {
            this.vectorClock.increment();
            const currentClock = this.vectorClock.getClock();
            
            const message = {
                type: type,
                data: data,
                senderNodeId: this.nodeId,
                senderClock: JSON.stringify(currentClock),
                timestamp: new Date().toISOString()
            };
            
            this.channel.publish(this.exchangeName, '', Buffer.from(JSON.stringify(message)));
            console.log('[Sync] Broadcast enviado: ' + type);
            return true;
        } catch (error) {
            console.error('[Sync] Error:', error);
            return false;
        }
    }
    
    on(type, handler) {
        this.handlers.set(type, handler);
    }
    
    getVectorClock() {
        return this.vectorClock.getClock();
    }
}

module.exports = SyncService;