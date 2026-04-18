 # Aerolíneas Rafael Pabón - Sistema de Reservas Distribuido

## Requisitos previos

- Node.js v18+
- Docker Desktop
- Git

## Clonar el proyecto

```bash
git clone <url-del-repositorio>
cd rafael-pabon-airlines
Ejecutar Backend
bash
cd backend
docker-compose up -d
npm install
npm start
Ejecutar Frontend
bash
cd frontend
npm install
npm run dev
URLs de acceso
Servicio	URL
Frontend	http://localhost:5173
Backend Nodo 1 (Bogotá)	http://localhost:3001
Backend Nodo 2 (Madrid)	http://localhost:3002
Backend Nodo 3 (Tokio)	http://localhost:3003
RabbitMQ Management	http://localhost:15672 (admin/admin)
Probar el sistema
bash
# Ejecutar pruebas automáticas (en otra terminal)
cd backend
node scripts/load-data.js "02 - Practica 3 Dataset Flights.csv"
