class VectorClock {
    constructor(nodeId, totalNodes = 3) {
        this.nodeId = nodeId;
        this.totalNodes = totalNodes;
        this.clock = {};
        
        for (let i = 1; i <= totalNodes; i++) {
            this.clock['node_' + i] = 0;
        }
    }
    
    increment() {
        this.clock['node_' + this.nodeId]++;
        return this.getClock();
    }
    
    update(remoteClock) {
        let updated = false;
        
        for (let i = 1; i <= this.totalNodes; i++) {
            const nodeKey = 'node_' + i;
            if (remoteClock[nodeKey] > this.clock[nodeKey]) {
                this.clock[nodeKey] = remoteClock[nodeKey];
                updated = true;
            }
        }
        
        this.clock['node_' + this.nodeId]++;
        return updated;
    }
    
    compare(clockA, clockB) {
        let aLessOrEqual = true;
        let bLessOrEqual = true;
        
        for (let i = 1; i <= this.totalNodes; i++) {
            const nodeKey = 'node_' + i;
            const valA = clockA[nodeKey] || 0;
            const valB = clockB[nodeKey] || 0;
            
            if (valA > valB) {
                aLessOrEqual = false;
            }
            if (valB > valA) {
                bLessOrEqual = false;
            }
        }
        
        if (aLessOrEqual && !bLessOrEqual) return -1;
        if (!aLessOrEqual && bLessOrEqual) return 1;
        return 0;
    }
    
    isCausallyBefore(clockA, clockB) {
        return this.compare(clockA, clockB) === -1;
    }
    
    areConcurrent(clockA, clockB) {
        return this.compare(clockA, clockB) === 0 && 
               JSON.stringify(clockA) !== JSON.stringify(clockB);
    }
    
    resolveConflict(localClock, remoteClock, localNodeId, remoteNodeId) {
        const comparison = this.compare(localClock, remoteClock);
        
        if (comparison === -1) {
            return {
                winner: 'remote',
                reason: 'Causal: remote ocurrio despues'
            };
        }
        if (comparison === 1) {
            return {
                winner: 'local',
                reason: 'Causal: local ocurrio despues'
            };
        }
        
        const localSum = Object.values(localClock).reduce(function(a, b) { return a + b; }, 0);
        const remoteSum = Object.values(remoteClock).reduce(function(a, b) { return a + b; }, 0);
        
        if (localSum > remoteSum) {
            return {
                winner: 'local',
                reason: 'Concurrente - mayor suma de vectores'
            };
        }
        if (remoteSum > localSum) {
            return {
                winner: 'remote',
                reason: 'Concurrente - mayor suma de vectores'
            };
        }
        
        if (localNodeId < remoteNodeId) {
            return {
                winner: 'local',
                reason: 'Empate - menor ID de nodo'
            };
        }
        
        return {
            winner: 'remote',
            reason: 'Empate - menor ID de nodo'
        };
    }
    
    getClock() {
        return JSON.parse(JSON.stringify(this.clock));
    }
    
    toJSON() {
        return this.clock;
    }
    
    static fromObject(nodeId, clockData, totalNodes = 3) {
        const vc = new VectorClock(nodeId, totalNodes);
        for (let i = 1; i <= totalNodes; i++) {
            const nodeKey = 'node_' + i;
            if (clockData[nodeKey] !== undefined) {
                vc.clock[nodeKey] = clockData[nodeKey];
            }
        }
        return vc;
    }
    
    serialize() {
        return JSON.stringify(this.clock);
    }
    
    static deserialize(serialized) {
        return JSON.parse(serialized);
    }
}

module.exports = VectorClock;