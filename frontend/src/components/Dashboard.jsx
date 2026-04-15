import React from 'react';
import { useTranslation } from 'react-i18next';

function ProgressBar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="progress-bar">
      <div className="progress-fill" style={{ width: pct + '%', background: color }} />
    </div>
  );
}

export default function Dashboard({ data }) {
  const { t } = useTranslation();
  const { sales, seats, flights, sync, nodeInfo, revenue } = data;
  const vc = nodeInfo?.vectorClock || {};

  const kpis = [
    {
      label:  t('totalRevenue'),
      value:  sales?.total_revenue_formatted || '$0.00',
      sub:    `${sales?.total_sales || 0} ${t('sales')}`,
      icon:   'fa-dollar-sign',
      color:  '#3960FB', bg: '#EBEFFF', accent: '#3960FB',
    },
    {
      label:  t('occupancyRate'),
      value:  (seats?.sold_percentage || 0) + '%',
      sub:    `${seats?.sold || 0} ${t('soldSeats')}`,
      icon:   'fa-chair',
      color:  '#0CAF60', bg: '#E6FBF1', accent: '#0CAF60',
    },
    {
      label:  t('totalSales'),
      value:  String(sales?.total_sales || 0),
      sub:    `${sales?.unique_passengers || 0} ${t('uniquePassengers')}`,
      icon:   'fa-ticket',
      color:  '#7C3AED', bg: '#F5F0FF', accent: '#7C3AED',
    },
    {
      label:  t('syncStatus'),
      value:  sync?.is_healthy ? t('active') : t('offline'),
      sub:    sync?.mode || '—',
      icon:   sync?.is_healthy ? 'fa-circle-check' : 'fa-circle-xmark',
      color:  sync?.is_healthy ? '#0CAF60' : '#EF4444',
      bg:     sync?.is_healthy ? '#E6FBF1' : '#FEF2F2',
      accent: sync?.is_healthy ? '#0CAF60' : '#EF4444',
    },
  ];

  const seatRows = [
    { label: t('available'), value: seats?.available || 0, color: '#3960FB', total: seats?.total || 1 },
    { label: t('reserved'),  value: seats?.reserved  || 0, color: '#CA8A04', total: seats?.total || 1 },
    { label: t('sold'),      value: seats?.sold      || 0, color: '#6B7A99', total: seats?.total || 1 },
    { label: t('refunded'),  value: seats?.refunded  || 0, color: '#EF4444', total: seats?.total || 1 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Title */}
      <div className="fade-up">
        <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#142258', marginBottom: '4px' }}>
          {t('managerDashboard')}
        </h2>
        <p style={{ color: '#6B7A99', fontSize: '0.88rem' }}>
          <i className="fa-solid fa-server" style={{ marginRight: '6px', color: '#C2CEFE' }} />
          {nodeInfo?.nodeName} (#{nodeInfo?.nodeId}) &middot; {t('realtimeUpdate')}
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }} className="fade-up-1">
        {kpis.map(({ label, value, sub, icon, color, bg, accent }) => (
          <div key={label} className="stat-card">
            <div className="stat-card-top" style={{ background: accent }} />
            <div className="icon-badge" style={{ background: bg }}>
              <i className={`fa-solid ${icon}`} style={{ color }} />
            </div>
            <p style={{ fontSize: '1.7rem', fontWeight: 800, color, lineHeight: 1, marginBottom: '3px' }}>{value}</p>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#142258', letterSpacing: '0.04em', marginBottom: '2px' }}>{label}</p>
            <p style={{ fontSize: '0.72rem', color: '#6B7A99' }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Middle row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Seat status */}
        <div className="card fade-up-2">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <i className="fa-solid fa-grid-2" style={{ color: '#3960FB', fontSize: '0.85rem' }} />
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7A99', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {t('seatStatus')}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {seatRows.map(({ label, value, color, total }) => (
              <div key={label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#142258' }}>{label}</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 700, color }}>{value}</span>
                </div>
                <ProgressBar value={value} max={total} color={color} />
              </div>
            ))}
          </div>
        </div>

        {/* Revenue by class */}
        <div className="card fade-up-2">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <i className="fa-solid fa-chart-bar" style={{ color: '#3960FB', fontSize: '0.85rem' }} />
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7A99', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {t('revenueByClass')}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: t('firstClass'), icon: 'fa-star',  data: revenue?.first_class, color: '#D97706', bg: '#FEF9C3' },
              { label: t('economy'),    icon: 'fa-plane', data: revenue?.economy,      color: '#3960FB', bg: '#EBEFFF' },
            ].map(({ label, icon, data, color, bg }) => (
              <div key={label} style={{ background: bg, borderRadius: '14px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <p style={{ fontWeight: 700, color: '#142258', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <i className={`fa-solid ${icon}`} style={{ color, fontSize: '0.75rem' }} />
                    {label}
                  </p>
                  <p style={{ fontWeight: 800, color, fontSize: '1.1rem' }}>
                    ${(data?.total_revenue || 0).toLocaleString()}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <span style={{ fontSize: '0.75rem', color: '#6B7A99' }}>
                    {data?.tickets_sold || 0} {t('tickets')}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#6B7A99' }}>
                    {t('average')} ${(data?.average_price || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Flights */}
        <div className="card fade-up-3">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <i className="fa-solid fa-plane-circle-check" style={{ color: '#3960FB', fontSize: '0.85rem' }} />
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7A99', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {t('flightStatus')}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {[
              { label: t('totalFlights'),     value: flights?.total_flights || 0, color: '#142258' },
              { label: t('scheduledFlights'), value: flights?.scheduled     || 0, color: '#3960FB' },
              { label: t('upcoming'),         value: flights?.upcoming      || 0, color: '#0CAF60' },
              { label: t('delayed'),          value: flights?.delayed       || 0, color: '#CA8A04' },
              { label: t('cancelled'),        value: flights?.cancelled     || 0, color: '#EF4444' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 0', borderBottom: '1px solid #EBEFFF',
              }}>
                <span style={{ fontSize: '0.88rem', color: '#142258', fontWeight: 500 }}>{label}</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Vector clock */}
        <div className="card fade-up-3">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <i className="fa-solid fa-clock-rotate-left" style={{ color: '#3960FB', fontSize: '0.85rem' }} />
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6B7A99', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              {t('vectorClock')}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            {Object.entries(vc).map(([node, val]) => (
              <div key={node} style={{
                flex: 1, textAlign: 'center',
                background: '#EBEFFF', borderRadius: '12px', padding: '14px 8px',
              }}>
                <p style={{ fontSize: '1.6rem', fontWeight: 800, color: '#3960FB', lineHeight: 1, marginBottom: '3px' }}>{val}</p>
                <p style={{ fontSize: '0.65rem', fontWeight: 600, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {node.replace('_', ' ')}
                </p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              { label: t('activeNode'), value: `${nodeInfo?.nodeName} (#${nodeInfo?.nodeId})` },
              { label: t('mode'),       value: sync?.mode || '—' },
              { label: t('lastSync'),   value: sync?.last_sync ? new Date(sync.last_sync).toLocaleString() : 'N/A' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #EBEFFF' }}>
                <span style={{ fontSize: '0.78rem', color: '#6B7A99' }}>{label}</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#142258' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
