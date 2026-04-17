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

al cargar para los precios tienes q cargar los siguientes comandos son dos
docker exec -it backend-postgres-1 psql -U admin -d rafael_pabon -c "

UPDATE flights SET

    first_class_price = CASE

        WHEN economy_price = 250 THEN 750

        WHEN economy_price = 800 THEN 2400

        WHEN economy_price = 1200 THEN 3600

        WHEN economy_price = 1400 THEN 4200

        WHEN economy_price = 400 THEN 1200

        WHEN economy_price = 750 THEN 2250

        WHEN economy_price = 900 THEN 2700

        WHEN economy_price = 1000 THEN 3000

        WHEN economy_price = 1500 THEN 4500

        WHEN economy_price = 700 THEN 2100

        WHEN economy_price = 650 THEN 1950

        WHEN economy_price = 600 THEN 1800

        WHEN economy_price = 500 THEN 1500

        WHEN economy_price = 300 THEN 900

        WHEN economy_price = 200 THEN 600

        WHEN economy_price = 150 THEN 450

        WHEN economy_price = 350 THEN 1050

        WHEN economy_price = 450 THEN 1350

        WHEN economy_price = 550 THEN 1650

        WHEN economy_price = 850 THEN 2550

        WHEN economy_price = 950 THEN 2850

        WHEN economy_price = 1050 THEN 3150

        WHEN economy_price = 1150 THEN 3450

        WHEN economy_price = 1250 THEN 3750

        WHEN economy_price = 1300 THEN 3900

        WHEN economy_price = 1350 THEN 4050

        WHEN economy_price = 1450 THEN 4350

        WHEN economy_price = 1550 THEN 4650

        WHEN economy_price = 1600 THEN 4800

        WHEN economy_price = 1650 THEN 4950

        WHEN economy_price = 1700 THEN 5100

        WHEN economy_price = 1750 THEN 5250

        WHEN economy_price = 1800 THEN 5400

        WHEN economy_price = 1850 THEN 5550

        WHEN economy_price = 1900 THEN 5700

        WHEN economy_price = 1950 THEN 5850

        WHEN economy_price = 2000 THEN 6000

        ELSE economy_price * 3

    END

WHERE first_class_price IS NULL OR first_class_price = 0;

"
---------------------------------------- 
docker exec -it backend-postgres-1 psql -U admin -d rafael_pabon -c "

UPDATE flights SET

    economy_price = CASE

        WHEN origin_code = 'ATL' AND destination_code = 'DFW' THEN 250

        WHEN origin_code = 'ATL' AND destination_code = 'LON' THEN 800

        WHEN origin_code = 'ATL' AND destination_code = 'DXB' THEN 1200

        WHEN origin_code = 'ATL' AND destination_code = 'TYO' THEN 1400

        WHEN origin_code = 'ATL' AND destination_code = 'LAX' THEN 400

        WHEN origin_code = 'ATL' AND destination_code = 'PAR' THEN 750

        WHEN origin_code = 'ATL' AND destination_code = 'FRA' THEN 800

        WHEN origin_code = 'ATL' AND destination_code = 'IST' THEN 1000

        WHEN origin_code = 'ATL' AND destination_code = 'SIN' THEN 1500

        WHEN origin_code = 'ATL' AND destination_code = 'MAD' THEN 900

        WHEN origin_code = 'ATL' AND destination_code = 'AMS' THEN 850

        WHEN origin_code = 'ATL' AND destination_code = 'CAN' THEN 1400

        WHEN origin_code = 'ATL' AND destination_code = 'SAO' THEN 900

        WHEN origin_code = 'PEK' AND destination_code = 'ATL' THEN 1400

        WHEN origin_code = 'PEK' AND destination_code = 'DXB' THEN 700

        WHEN origin_code = 'PEK' AND destination_code = 'TYO' THEN 500

        WHEN origin_code = 'PEK' AND destination_code = 'LON' THEN 900

        WHEN origin_code = 'PEK' AND destination_code = 'LAX' THEN 950

        WHEN origin_code = 'PEK' AND destination_code = 'PAR' THEN 950

        WHEN origin_code = 'PEK' AND destination_code = 'FRA' THEN 900

        WHEN origin_code = 'PEK' AND destination_code = 'IST' THEN 600

        WHEN origin_code = 'PEK' AND destination_code = 'SIN' THEN 950

        WHEN origin_code = 'PEK' AND destination_code = 'MAD' THEN 900

        WHEN origin_code = 'PEK' AND destination_code = 'AMS' THEN 1150

        WHEN origin_code = 'PEK' AND destination_code = 'DFW' THEN 1100

        WHEN origin_code = 'PEK' AND destination_code = 'CAN' THEN 200

        WHEN origin_code = 'PEK' AND destination_code = 'SAO' THEN 1700

        WHEN origin_code = 'DXB' AND destination_code = 'ATL' THEN 400

        WHEN origin_code = 'DXB' AND destination_code = 'PEK' THEN 700

        WHEN origin_code = 'DXB' AND destination_code = 'TYO' THEN 750

        WHEN origin_code = 'DXB' AND destination_code = 'LON' THEN 650

        WHEN origin_code = 'DXB' AND destination_code = 'LAX' THEN 1300

        WHEN origin_code = 'DXB' AND destination_code = 'PAR' THEN 700

        WHEN origin_code = 'DXB' AND destination_code = 'FRA' THEN 600

        WHEN origin_code = 'DXB' AND destination_code = 'IST' THEN 400

        WHEN origin_code = 'DXB' AND destination_code = 'SIN' THEN 600

        WHEN origin_code = 'DXB' AND destination_code = 'MAD' THEN 650

        WHEN origin_code = 'DXB' AND destination_code = 'AMS' THEN 650

        WHEN origin_code = 'DXB' AND destination_code = 'DFW' THEN 1200

        WHEN origin_code = 'DXB' AND destination_code = 'CAN' THEN 650

        WHEN origin_code = 'DXB' AND destination_code = 'SAO' THEN 1400

        WHEN origin_code = 'TYO' AND destination_code = 'ATL' THEN 1400

        WHEN origin_code = 'TYO' AND destination_code = 'PEK' THEN 500

        WHEN origin_code = 'TYO' AND destination_code = 'DXB' THEN 750

        WHEN origin_code = 'TYO' AND destination_code = 'LON' THEN 1000

        WHEN origin_code = 'TYO' AND destination_code = 'LAX' THEN 900

        WHEN origin_code = 'TYO' AND destination_code = 'PAR' THEN 1050

        WHEN origin_code = 'TYO' AND destination_code = 'FRA' THEN 900

        WHEN origin_code = 'TYO' AND destination_code = 'IST' THEN 900

        WHEN origin_code = 'TYO' AND destination_code = 'SIN' THEN 700

        WHEN origin_code = 'TYO' AND destination_code = 'MAD' THEN 1100

        WHEN origin_code = 'TYO' AND destination_code = 'AMS' THEN 1100

        WHEN origin_code = 'TYO' AND destination_code = 'DFW' THEN 1350

        WHEN origin_code = 'TYO' AND destination_code = 'CAN' THEN 550

        WHEN origin_code = 'TYO' AND destination_code = 'SAO' THEN 1400

        WHEN origin_code = 'LON' AND destination_code = 'ATL' THEN 700

        WHEN origin_code = 'LON' AND destination_code = 'PEK' THEN 900

        WHEN origin_code = 'LON' AND destination_code = 'DXB' THEN 650

        WHEN origin_code = 'LON' AND destination_code = 'TYO' THEN 1000

        WHEN origin_code = 'LON' AND destination_code = 'LAX' THEN 800

        WHEN origin_code = 'LON' AND destination_code = 'PAR' THEN 150

        WHEN origin_code = 'LON' AND destination_code = 'FRA' THEN 200

        WHEN origin_code = 'LON' AND destination_code = 'IST' THEN 400

        WHEN origin_code = 'LON' AND destination_code = 'SIN' THEN 1200

        WHEN origin_code = 'LON' AND destination_code = 'MAD' THEN 200

        WHEN origin_code = 'LON' AND destination_code = 'AMS' THEN 150

        WHEN origin_code = 'LON' AND destination_code = 'DFW' THEN 700

        WHEN origin_code = 'LON' AND destination_code = 'CAN' THEN 950

        WHEN origin_code = 'LON' AND destination_code = 'SAO' THEN 1100

        WHEN origin_code = 'LAX' AND destination_code = 'ATL' THEN 300

        WHEN origin_code = 'LAX' AND destination_code = 'PEK' THEN 950

        WHEN origin_code = 'LAX' AND destination_code = 'DXB' THEN 1300

        WHEN origin_code = 'LAX' AND destination_code = 'TYO' THEN 900

        WHEN origin_code = 'LAX' AND destination_code = 'LON' THEN 800

        WHEN origin_code = 'LAX' AND destination_code = 'PAR' THEN 850

        WHEN origin_code = 'LAX' AND destination_code = 'FRA' THEN 900

        WHEN origin_code = 'LAX' AND destination_code = 'IST' THEN 1100

        WHEN origin_code = 'LAX' AND destination_code = 'SIN' THEN 1400

        WHEN origin_code = 'LAX' AND destination_code = 'MAD' THEN 850

        WHEN origin_code = 'LAX' AND destination_code = 'AMS' THEN 900

        WHEN origin_code = 'LAX' AND destination_code = 'DFW' THEN 250

        WHEN origin_code = 'LAX' AND destination_code = 'CAN' THEN 1150

        WHEN origin_code = 'LAX' AND destination_code = 'SAO' THEN 1000

        WHEN origin_code = 'PAR' AND destination_code = 'ATL' THEN 750

        WHEN origin_code = 'PAR' AND destination_code = 'PEK' THEN 950

        WHEN origin_code = 'PAR' AND destination_code = 'DXB' THEN 700

        WHEN origin_code = 'PAR' AND destination_code = 'TYO' THEN 1050

        WHEN origin_code = 'PAR' AND destination_code = 'LON' THEN 150

        WHEN origin_code = 'PAR' AND destination_code = 'FRA' THEN 150

        WHEN origin_code = 'PAR' AND destination_code = 'IST' THEN 400

        WHEN origin_code = 'PAR' AND destination_code = 'SIN' THEN 1100

        WHEN origin_code = 'PAR' AND destination_code = 'MAD' THEN 200

        WHEN origin_code = 'PAR' AND destination_code = 'AMS' THEN 180

        WHEN origin_code = 'PAR' AND destination_code = 'DFW' THEN 700

        WHEN origin_code = 'PAR' AND destination_code = 'CAN' THEN 950

        WHEN origin_code = 'PAR' AND destination_code = 'SAO' THEN 1050

        WHEN origin_code = 'FRA' AND destination_code = 'ATL' THEN 800

        WHEN origin_code = 'FRA' AND destination_code = 'PEK' THEN 900

        WHEN origin_code = 'FRA' AND destination_code = 'DXB' THEN 600

        WHEN origin_code = 'FRA' AND destination_code = 'TYO' THEN 900

        WHEN origin_code = 'FRA' AND destination_code = 'LON' THEN 200

        WHEN origin_code = 'FRA' AND destination_code = 'PAR' THEN 150

        WHEN origin_code = 'FRA' AND destination_code = 'IST' THEN 350

        WHEN origin_code = 'FRA' AND destination_code = 'SIN' THEN 1100

        WHEN origin_code = 'FRA' AND destination_code = 'MAD' THEN 200

        WHEN origin_code = 'FRA' AND destination_code = 'AMS' THEN 180

        WHEN origin_code = 'FRA' AND destination_code = 'DFW' THEN 800

        WHEN origin_code = 'FRA' AND destination_code = 'CAN' THEN 900

        WHEN origin_code = 'FRA' AND destination_code = 'SAO' THEN 1000

        WHEN origin_code = 'IST' AND destination_code = 'ATL' THEN 1000

        WHEN origin_code = 'IST' AND destination_code = 'PEK' THEN 600

        WHEN origin_code = 'IST' AND destination_code = 'DXB' THEN 400

        WHEN origin_code = 'IST' AND destination_code = 'TYO' THEN 900

        WHEN origin_code = 'IST' AND destination_code = 'LON' THEN 400

        WHEN origin_code = 'IST' AND destination_code = 'LAX' THEN 1100

        WHEN origin_code = 'IST' AND destination_code = 'PAR' THEN 400

        WHEN origin_code = 'IST' AND destination_code = 'FRA' THEN 350

        WHEN origin_code = 'IST' AND destination_code = 'SIN' THEN 800

        WHEN origin_code = 'IST' AND destination_code = 'MAD' THEN 450

        WHEN origin_code = 'IST' AND destination_code = 'AMS' THEN 500

        WHEN origin_code = 'IST' AND destination_code = 'DFW' THEN 1000

        WHEN origin_code = 'IST' AND destination_code = 'CAN' THEN 800

        WHEN origin_code = 'IST' AND destination_code = 'SAO' THEN 1200

        WHEN origin_code = 'SIN' AND destination_code = 'ATL' THEN 1500

        WHEN origin_code = 'SIN' AND destination_code = 'PEK' THEN 950

        WHEN origin_code = 'SIN' AND destination_code = 'DXB' THEN 600

        WHEN origin_code = 'SIN' AND destination_code = 'TYO' THEN 700

        WHEN origin_code = 'SIN' AND destination_code = 'LON' THEN 1200

        WHEN origin_code = 'SIN' AND destination_code = 'LAX' THEN 1400

        WHEN origin_code = 'SIN' AND destination_code = 'PAR' THEN 1100

        WHEN origin_code = 'SIN' AND destination_code = 'FRA' THEN 1100

        WHEN origin_code = 'SIN' AND destination_code = 'IST' THEN 800

        WHEN origin_code = 'SIN' AND destination_code = 'MAD' THEN 1000

        WHEN origin_code = 'SIN' AND destination_code = 'AMS' THEN 1000

        WHEN origin_code = 'SIN' AND destination_code = 'DFW' THEN 1700

        WHEN origin_code = 'SIN' AND destination_code = 'CAN' THEN 500

        WHEN origin_code = 'SIN' AND destination_code = 'SAO' THEN 1400

        WHEN origin_code = 'MAD' AND destination_code = 'ATL' THEN 900

        WHEN origin_code = 'MAD' AND destination_code = 'PEK' THEN 900

        WHEN origin_code = 'MAD' AND destination_code = 'DXB' THEN 650

        WHEN origin_code = 'MAD' AND destination_code = 'TYO' THEN 1100

        WHEN origin_code = 'MAD' AND destination_code = 'LON' THEN 200

        WHEN origin_code = 'MAD' AND destination_code = 'LAX' THEN 850

        WHEN origin_code = 'MAD' AND destination_code = 'PAR' THEN 200

        WHEN origin_code = 'MAD' AND destination_code = 'FRA' THEN 200

        WHEN origin_code = 'MAD' AND destination_code = 'IST' THEN 450

        WHEN origin_code = 'MAD' AND destination_code = 'SIN' THEN 1000

        WHEN origin_code = 'MAD' AND destination_code = 'AMS' THEN 200

        WHEN origin_code = 'MAD' AND destination_code = 'DFW' THEN 850

        WHEN origin_code = 'MAD' AND destination_code = 'CAN' THEN 950

        WHEN origin_code = 'MAD' AND destination_code = 'SAO' THEN 1000

        WHEN origin_code = 'AMS' AND destination_code = 'ATL' THEN 850

        WHEN origin_code = 'AMS' AND destination_code = 'PEK' THEN 1150

        WHEN origin_code = 'AMS' AND destination_code = 'DXB' THEN 650

        WHEN origin_code = 'AMS' AND destination_code = 'TYO' THEN 1100

        WHEN origin_code = 'AMS' AND destination_code = 'LON' THEN 150

        WHEN origin_code = 'AMS' AND destination_code = 'LAX' THEN 900

        WHEN origin_code = 'AMS' AND destination_code = 'PAR' THEN 180

        WHEN origin_code = 'AMS' AND destination_code = 'FRA' THEN 180

        WHEN origin_code = 'AMS' AND destination_code = 'IST' THEN 500

        WHEN origin_code = 'AMS' AND destination_code = 'SIN' THEN 1000

        WHEN origin_code = 'AMS' AND destination_code = 'MAD' THEN 200

        WHEN origin_code = 'AMS' AND destination_code = 'DFW' THEN 800

        WHEN origin_code = 'AMS' AND destination_code = 'CAN' THEN 900

        WHEN origin_code = 'AMS' AND destination_code = 'SAO' THEN 1050

        WHEN origin_code = 'DFW' AND destination_code = 'ATL' THEN 200

        WHEN origin_code = 'DFW' AND destination_code = 'PEK' THEN 1100

        WHEN origin_code = 'DFW' AND destination_code = 'DXB' THEN 1200

        WHEN origin_code = 'DFW' AND destination_code = 'TYO' THEN 1350

        WHEN origin_code = 'DFW' AND destination_code = 'LON' THEN 700

        WHEN origin_code = 'DFW' AND destination_code = 'LAX' THEN 250

        WHEN origin_code = 'DFW' AND destination_code = 'PAR' THEN 700

        WHEN origin_code = 'DFW' AND destination_code = 'FRA' THEN 800

        WHEN origin_code = 'DFW' AND destination_code = 'IST' THEN 1000

        WHEN origin_code = 'DFW' AND destination_code = 'SIN' THEN 1700

        WHEN origin_code = 'DFW' AND destination_code = 'MAD' THEN 850

        WHEN origin_code = 'DFW' AND destination_code = 'AMS' THEN 800

        WHEN origin_code = 'DFW' AND destination_code = 'CAN' THEN 1200

        WHEN origin_code = 'DFW' AND destination_code = 'SAO' THEN 950

        WHEN origin_code = 'CAN' AND destination_code = 'ATL' THEN 1400

        WHEN origin_code = 'CAN' AND destination_code = 'PEK' THEN 200

        WHEN origin_code = 'CAN' AND destination_code = 'DXB' THEN 650

        WHEN origin_code = 'CAN' AND destination_code = 'TYO' THEN 550

        WHEN origin_code = 'CAN' AND destination_code = 'LON' THEN 950

        WHEN origin_code = 'CAN' AND destination_code = 'LAX' THEN 1150

        WHEN origin_code = 'CAN' AND destination_code = 'PAR' THEN 950

        WHEN origin_code = 'CAN' AND destination_code = 'FRA' THEN 900

        WHEN origin_code = 'CAN' AND destination_code = 'IST' THEN 800

        WHEN origin_code = 'CAN' AND destination_code = 'SIN' THEN 500

        WHEN origin_code = 'CAN' AND destination_code = 'MAD' THEN 950

        WHEN origin_code = 'CAN' AND destination_code = 'AMS' THEN 900

        WHEN origin_code = 'CAN' AND destination_code = 'DFW' THEN 1200

        WHEN origin_code = 'CAN' AND destination_code = 'SAO' THEN 1700

        WHEN origin_code = 'SAO' AND destination_code = 'ATL' THEN 900

        WHEN origin_code = 'SAO' AND destination_code = 'PEK' THEN 1700

        WHEN origin_code = 'SAO' AND destination_code = 'DXB' THEN 1400

        WHEN origin_code = 'SAO' AND destination_code = 'TYO' THEN 1400

        WHEN origin_code = 'SAO' AND destination_code = 'LON' THEN 1100

        WHEN origin_code = 'SAO' AND destination_code = 'LAX' THEN 1000

        WHEN origin_code = 'SAO' AND destination_code = 'PAR' THEN 1050

        WHEN origin_code = 'SAO' AND destination_code = 'FRA' THEN 1000

        WHEN origin_code = 'SAO' AND destination_code = 'IST' THEN 1200

        WHEN origin_code = 'SAO' AND destination_code = 'SIN' THEN 1400

        WHEN origin_code = 'SAO' AND destination_code = 'MAD' THEN 1000

        WHEN origin_code = 'SAO' AND destination_code = 'AMS' THEN 1050

        WHEN origin_code = 'SAO' AND destination_code = 'DFW' THEN 950

        WHEN origin_code = 'SAO' AND destination_code = 'CAN' THEN 1700

        ELSE 300

    END,

    first_class_price = economy_price * 3

WHERE economy_price IS NULL OR economy_price = 0;

"

