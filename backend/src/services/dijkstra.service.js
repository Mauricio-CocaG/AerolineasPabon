/**
 * ALGORITMO DE DIJKSTRA - RUTAS ÓPTIMAS
 * Encuentra la ruta de menor costo o menor tiempo entre aeropuertos
 * Basado en la matriz de costos y tiempos de vuelo
 */

class DijkstraService {
    constructor() {
        // Grafo: Map<nodo, Array<{destino, costo, tiempo}>>
        this.graph = new Map();
        
        // Lista de aeropuertos disponibles (según tu Excel)
        this.airports = [
            'ATL', 'PEK', 'DXB', 'TYO', 'LON', 'LAX', 'PAR', 'FRA',
            'IST', 'SIN', 'MAD', 'AMS', 'DFW', 'CAN', 'SAO'
        ];
    }
    
    /**
     * Agregar una ruta entre dos aeropuertos
     * @param {string} origin - Aeropuerto origen (código IATA)
     * @param {string} destination - Aeropuerto destino
     * @param {number} cost - Costo del vuelo (desde matriz de precios)
     * @param {number} time - Tiempo de vuelo en horas (desde matriz de tiempos)
     */
    addRoute(origin, destination, cost, time) {
        // Agregar ruta de ida
        if (!this.graph.has(origin)) {
            this.graph.set(origin, []);
        }
        this.graph.get(origin).push({ destination, cost, time });
        
        // Agregar ruta de vuelta (grafo no dirigido)
        if (!this.graph.has(destination)) {
            this.graph.set(destination, []);
        }
        this.graph.get(destination).push({ destination: origin, cost, time });
    }
    
    /**
     * Cargar rutas desde las matrices de precios y tiempos
     * @param {Array} priceMatrix - Matriz de costos entre aeropuertos
     * @param {Array} timeMatrix - Matriz de tiempos entre aeropuertos
     */
    loadFromMatrices(priceMatrix, timeMatrix) {
        for (let i = 0; i < this.airports.length; i++) {
            for (let j = 0; j < this.airports.length; j++) {
                if (i !== j && priceMatrix[i][j] > 0) {
                    this.addRoute(
                        this.airports[i],
                        this.airports[j],
                        priceMatrix[i][j],
                        timeMatrix[i][j]
                    );
                }
            }
        }
        console.log(`[Dijkstra] Cargadas ${this.graph.size} rutas desde matrices`);
    }
    
    /**
     * Encontrar la ruta más económica usando Dijkstra
     * @param {string} start - Aeropuerto de inicio
     * @param {string} end - Aeropuerto de destino
     * @returns {Object} Ruta con costo total y camino
     */
    findCheapestRoute(start, end) {
        // Validar aeropuertos
        if (!this.airports.includes(start) || !this.airports.includes(end)) {
            return { found: false, error: 'Aeropuerto no válido' };
        }
        
        // Inicializar distancias
        const distances = new Map();
        const previous = new Map();
        const unvisited = new Set();
        
        for (const airport of this.airports) {
            distances.set(airport, Infinity);
            unvisited.add(airport);
        }
        distances.set(start, 0);
        
        while (unvisited.size > 0) {
            // Encontrar nodo no visitado con menor distancia
            let current = null;
            let minDistance = Infinity;
            
            for (const airport of unvisited) {
                if (distances.get(airport) < minDistance) {
                    minDistance = distances.get(airport);
                    current = airport;
                }
            }
            
            if (current === null || current === end) break;
            unvisited.delete(current);
            
            // Actualizar distancias de los vecinos
            const neighbors = this.graph.get(current) || [];
            for (const neighbor of neighbors) {
                if (unvisited.has(neighbor.destination)) {
                    const newDistance = distances.get(current) + neighbor.cost;
                    if (newDistance < distances.get(neighbor.destination)) {
                        distances.set(neighbor.destination, newDistance);
                        previous.set(neighbor.destination, {
                            from: current,
                            cost: neighbor.cost,
                            time: neighbor.time
                        });
                    }
                }
            }
        }
        
        // Reconstruir la ruta
        if (distances.get(end) === Infinity) {
            return { found: false, error: 'No existe ruta entre los aeropuertos' };
        }
        
        const path = [];
        let current = end;
        let totalCost = 0;
        let totalTime = 0;
        
        while (current !== start && previous.has(current)) {
            const prev = previous.get(current);
            path.unshift({
                from: prev.from,
                to: current,
                cost: prev.cost,
                time: prev.time
            });
            totalCost += prev.cost;
            totalTime += prev.time;
            current = prev.from;
        }
        
        return {
            found: true,
            origin: start,
            destination: end,
            totalCost: totalCost,
            totalTime: totalTime,
            stops: path.length - 1,
            route: path,
            flights: path.length
        };
    }
    
    /**
     * Encontrar la ruta más rápida (menor tiempo)
     * @param {string} start - Aeropuerto de inicio
     * @param {string} end - Aeropuerto de destino
     * @returns {Object} Ruta con tiempo total y camino
     */
    findFastestRoute(start, end) {
        if (!this.airports.includes(start) || !this.airports.includes(end)) {
            return { found: false, error: 'Aeropuerto no válido' };
        }
        
        const times = new Map();
        const previous = new Map();
        const unvisited = new Set();
        
        for (const airport of this.airports) {
            times.set(airport, Infinity);
            unvisited.add(airport);
        }
        times.set(start, 0);
        
        while (unvisited.size > 0) {
            let current = null;
            let minTime = Infinity;
            
            for (const airport of unvisited) {
                if (times.get(airport) < minTime) {
                    minTime = times.get(airport);
                    current = airport;
                }
            }
            
            if (current === null || current === end) break;
            unvisited.delete(current);
            
            const neighbors = this.graph.get(current) || [];
            for (const neighbor of neighbors) {
                if (unvisited.has(neighbor.destination)) {
                    const newTime = times.get(current) + neighbor.time;
                    if (newTime < times.get(neighbor.destination)) {
                        times.set(neighbor.destination, newTime);
                        previous.set(neighbor.destination, {
                            from: current,
                            cost: neighbor.cost,
                            time: neighbor.time
                        });
                    }
                }
            }
        }
        
        if (times.get(end) === Infinity) {
            return { found: false, error: 'No existe ruta entre los aeropuertos' };
        }
        
        const path = [];
        let current = end;
        let totalCost = 0;
        let totalTime = 0;
        
        while (current !== start && previous.has(current)) {
            const prev = previous.get(current);
            path.unshift({
                from: prev.from,
                to: current,
                cost: prev.cost,
                time: prev.time
            });
            totalCost += prev.cost;
            totalTime += prev.time;
            current = prev.from;
        }
        
        return {
            found: true,
            origin: start,
            destination: end,
            totalCost: totalCost,
            totalTime: totalTime,
            stops: path.length - 1,
            route: path
        };
    }
    
    /**
     * Encontrar todas las rutas posibles (para TSP)
     * @param {string} start - Aeropuerto de inicio
     * @param {Array} destinations - Lista de destinos a visitar
     * @returns {Array} Todas las combinaciones de rutas
     */
    findAllPossibleRoutes(start, destinations) {
        const routes = [];
        const permutations = this.getPermutations(destinations);
        
        for (const perm of permutations) {
            const fullRoute = [start, ...perm, start];
            let isValid = true;
            let totalCost = 0;
            let totalTime = 0;
            const segments = [];
            
            for (let i = 0; i < fullRoute.length - 1; i++) {
                const from = fullRoute[i];
                const to = fullRoute[i + 1];
                const route = this.findCheapestRoute(from, to);
                
                if (!route.found) {
                    isValid = false;
                    break;
                }
                
                totalCost += route.totalCost;
                totalTime += route.totalTime;
                segments.push(route);
            }
            
            if (isValid) {
                routes.push({
                    order: fullRoute,
                    totalCost,
                    totalTime,
                    segments
                });
            }
        }
        
        return routes;
    }
    
    /**
     * Obtener todas las permutaciones de un array
     * @param {Array} arr - Array a permutar
     * @returns {Array} Array de permutaciones
     */
    getPermutations(arr) {
        if (arr.length === 0) return [[]];
        
        const result = [];
        for (let i = 0; i < arr.length; i++) {
            const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
            const perms = this.getPermutations(rest);
            for (const perm of perms) {
                result.push([arr[i], ...perm]);
            }
        }
        return result;
    }
    
    /**
     * Obtener lista de aeropuertos disponibles
     * @returns {Array} Lista de códigos IATA
     */
    getAirports() {
        return this.airports;
    }
    
    /**
     * Verificar si existe ruta directa entre dos aeropuertos
     * @param {string} origin - Aeropuerto origen
     * @param {string} destination - Aeropuerto destino
     * @returns {boolean} True si existe ruta directa
     */
    hasDirectRoute(origin, destination) {
        const neighbors = this.graph.get(origin) || [];
        return neighbors.some(n => n.destination === destination);
    }
    
    /**
     * Obtener costo de ruta directa
     * @param {string} origin - Aeropuerto origen
     * @param {string} destination - Aeropuerto destino
     * @returns {Object|null} Costo y tiempo o null
     */
    getDirectRoute(origin, destination) {
        const neighbors = this.graph.get(origin) || [];
        const route = neighbors.find(n => n.destination === destination);
        return route || null;
    }
}

module.exports = DijkstraService;