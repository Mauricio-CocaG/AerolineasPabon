import { useState, useEffect } from 'react';

// Cada nodo sirve una región geográfica distinta
const NODE_CONFIG = [
  { id: 1, name: 'BOGOTA', port: 3001, continents: ['NA', 'SA'] },
  { id: 2, name: 'MADRID', port: 3002, continents: ['EU', 'AF'] },
  { id: 3, name: 'TOKIO', port: 3003, continents: ['AS', 'OC'] },
];

function getNodeForContinent(continentCode) {
  const node = NODE_CONFIG.find(n => n.continents.includes(continentCode));
  return node || NODE_CONFIG[0];
}

export function useGeolocation() {
  const [geo, setGeo] = useState({
    city: 'Detectando...',
    country: '',
    continentCode: null,
    node: NODE_CONFIG[0],
    apiUrl: 'http://localhost:3001/api/v1',
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchGeo() {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (!res.ok) throw new Error('Geolocation API error');
        const data = await res.json();
        if (cancelled) return;

        const node = getNodeForContinent(data.continent_code);
        setGeo({
          city: data.city || 'Ciudad desconocida',
          country: data.country_name || '',
          continentCode: data.continent_code || 'NA',
          node,
          apiUrl: `http://localhost:${node.port}/api/v1`,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        // Fallback al nodo 1 (BOGOTA)
        setGeo(prev => ({
          ...prev,
          city: 'Bogotá',
          country: 'Colombia',
          loading: false,
          error: err.message,
        }));
      }
    }

    fetchGeo();
    return () => { cancelled = true; };
  }, []);

  return geo;
}

export { NODE_CONFIG };
