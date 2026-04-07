import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: {
        translation: {
          title: 'Aerolíneas Rafael Pabón',
          subtitle: 'Sistema de Reservas Distribuido',
          flights: 'Vuelos',
          search: 'Buscar',
          origin: 'Origen',
          destination: 'Destino',
          date: 'Fecha',
          available: 'Disponible',
          reserved: 'Reservado',
          sold: 'Vendido',
          refunded: 'En devolución',
          book: 'Reservar',
          buy: 'Comprar',
          cancel: 'Cancelar',
          passenger: 'Pasajero',
          passport: 'Pasaporte',
          name: 'Nombre',
          seat: 'Asiento',
          class: 'Clase',
          firstClass: 'Primera Clase',
          economy: 'Turista',
          boardingPass: 'Pase de Abordar',
          download: 'Descargar PDF',
          wallet: 'Agregar a Wallet',
          dashboard: 'Dashboard',
          language: 'Idioma',
          spanish: 'Español',
          english: 'Inglés',
          totalSales: 'Total Ventas',
          totalRevenue: 'Ingresos Totales',
          occupancyRate: 'Tasa de Ocupación',
          syncStatus: 'Estado Sincronización'
        }
      },
      en: {
        translation: {
          title: 'Rafael Pabon Airlines',
          subtitle: 'Distributed Booking System',
          flights: 'Flights',
          search: 'Search',
          origin: 'Origin',
          destination: 'Destination',
          date: 'Date',
          available: 'Available',
          reserved: 'Reserved',
          sold: 'Sold',
          refunded: 'Refunded',
          book: 'Book',
          buy: 'Buy',
          cancel: 'Cancel',
          passenger: 'Passenger',
          passport: 'Passport',
          name: 'Name',
          seat: 'Seat',
          class: 'Class',
          firstClass: 'First Class',
          economy: 'Economy',
          boardingPass: 'Boarding Pass',
          download: 'Download PDF',
          wallet: 'Add to Wallet',
          dashboard: 'Dashboard',
          language: 'Language',
          spanish: 'Spanish',
          english: 'English',
          totalSales: 'Total Sales',
          totalRevenue: 'Total Revenue',
          occupancyRate: 'Occupancy Rate',
          syncStatus: 'Sync Status'
        }
      }
    },
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
