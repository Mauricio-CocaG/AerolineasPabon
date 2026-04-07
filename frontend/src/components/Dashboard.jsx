import React from 'react';
import { useTranslation } from 'react-i18next';

function Dashboard({ data }) {
  const { t } = useTranslation();
  
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">📊 {t('dashboard')}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-3xl mb-2">💰</div>
          <div className="text-2xl font-bold text-airline-blue">
            {data.sales?.total_revenue_formatted || ''}
          </div>
          <div className="text-gray-600">{t('totalRevenue')}</div>
        </div>
        
        <div className="card text-center">
          <div className="text-3xl mb-2">🎫</div>
          <div className="text-2xl font-bold text-airline-blue">
            {data.sales?.total_sales || 0}
          </div>
          <div className="text-gray-600">{t('totalSales')}</div>
        </div>
        
        <div className="card text-center">
          <div className="text-3xl mb-2">💺</div>
          <div className="text-2xl font-bold text-airline-blue">
            {data.seats?.sold_percentage || 0}%
          </div>
          <div className="text-gray-600">{t('occupancyRate')}</div>
        </div>
        
        <div className="card text-center">
          <div className="text-3xl mb-2">🔄</div>
          <div className="text-2xl font-bold text-airline-blue">
            {data.sync?.is_healthy ? '✅' : '⚠️'}
          </div>
          <div className="text-gray-600">{t('syncStatus')}</div>
        </div>
      </div>
      
      <div className="card">
        <h3 className="font-bold mb-3">Estado de Asientos</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span>🟢 {t('available')}</span>
            <span className="font-bold">{data.seats?.available || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>🟡 {t('reserved')}</span>
            <span className="font-bold">{data.seats?.reserved || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>⚫ {t('sold')}</span>
            <span className="font-bold">{data.seats?.sold || 0}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>🔴 {t('refunded')}</span>
            <span className="font-bold">{data.seats?.refunded || 0}</span>
          </div>
        </div>
      </div>
      
      <div className="card">
        <h3 className="font-bold mb-3">Ingresos por Clase</h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span>✨ Primera Clase</span>
            <span className="font-bold text-airline-gold"></span>
          </div>
          <div className="flex justify-between items-center">
            <span>✈️ Clase Turista</span>
            <span className="font-bold text-airline-blue"></span>
          </div>
        </div>
      </div>
      
      <div className="card">
        <h3 className="font-bold mb-3">Estado del Nodo</h3>
        <div className="space-y-1 text-sm">
          <p><strong>Nodo:</strong> {data.nodeInfo?.nodeName} (ID: {data.nodeInfo?.nodeId})</p>
          <p><strong>Reloj Vectorial:</strong> {JSON.stringify(data.nodeInfo?.vectorClock)}</p>
          <p><strong>Última sincronización:</strong> {data.sync?.last_sync ? new Date(data.sync.last_sync).toLocaleString() : 'N/A'}</p>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
