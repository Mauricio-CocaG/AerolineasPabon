import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';

function ProgressBar({ value, max, color }) {
  const fillRef = useRef(null);
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  useEffect(() => {
    if (fillRef.current) {
      gsap.fromTo(fillRef.current,
        { width: '0%' },
        { width: pct + '%', duration: 1.1, ease: 'power2.out', delay: 0.6 }
      );
    }
  }, [pct]);
  return (
    <div className="progress-track">
      <div ref={fillRef} className="progress-fill" style={{ width: '0%', background: color }} />
    </div>
  );
}

function AnimatedVal({ value, prefix = '', suffix = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const num = parseFloat(String(value).replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return;
    gsap.fromTo({ v: 0 }, { v: num }, {
      duration: 1.2,
      ease: 'power2.out',
      delay: 0.15,
      onUpdate: function () {
        if (ref.current) {
          const rounded = Number.isInteger(num) ? Math.round(this.targets()[0].v) : this.targets()[0].v.toFixed(2);
          ref.current.textContent = prefix + rounded + suffix;
        }
      }
    });
  }, [value]);
  return <span ref={ref}>{prefix}{value}{suffix}</span>;
}

export default function Dashboard({ data }) {
  const { t } = useTranslation();
  const { sales, seats, flights, sync, nodeInfo, revenue } = data;
  const vc = nodeInfo?.vectorClock || {};

  const titleRef = useRef(null);
  const kpiRef = useRef(null);
  const gridRef = useRef(null);

  useEffect(() => {
    if (titleRef.current) {
      gsap.fromTo(titleRef.current.children,
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.08, ease: 'power3.out' }
      );
    }
    if (kpiRef.current) {
      gsap.fromTo(kpiRef.current.querySelectorAll('.kpi'),
        { opacity: 0, y: 24, scale: 0.94 },
        { opacity: 1, y: 0, scale: 1, duration: 0.42, stagger: 0.07, ease: 'back.out(1.3)', delay: 0.15 }
      );
    }
    if (gridRef.current) {
      gsap.fromTo(gridRef.current.querySelectorAll('.dash-card'),
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.42, stagger: 0.07, ease: 'power3.out', delay: 0.4 }
      );
    }
  }, []);

  const kpis = [
    {
      label:  t('totalRevenue'),
      value:  sales?.total_revenue_formatted || '$0.00',
      sub:    `${sales?.total_sales || 0} ${t('sales')}`,
      icon:   'fa-dollar-sign',
      color:  'var(--blue)', bg: 'var(--bl)', accent: 'var(--blue)',
    },
    {
      label:  t('occupancyRate'),
      value:  (seats?.sold_percentage || 0) + '%',
      sub:    `${seats?.sold || 0} ${t('soldSeats')}`,
      icon:   'fa-chair',
      color:  'var(--green)', bg: 'rgba(34,200,128,.1)', accent: 'var(--green)',
    },
    {
      label:  t('totalSales'),
      value:  String(sales?.total_sales || 0),
      sub:    `${sales?.unique_passengers || 0} ${t('uniquePassengers')}`,
      icon:   'fa-ticket',
      color:  '#A855F7', bg: 'rgba(168,85,247,.1)', accent: '#A855F7',
    },
    {
      label:  t('syncStatus'),
      value:  sync?.is_healthy ? t('active') : t('offline'),
      sub:    sync?.mode || '—',
      icon:   sync?.is_healthy ? 'fa-circle-check' : 'fa-circle-xmark',
      color:  sync?.is_healthy ? 'var(--green)' : 'var(--red)',
      bg:     sync?.is_healthy ? 'rgba(34,200,128,.1)' : 'rgba(255,80,80,.1)',
      accent: sync?.is_healthy ? 'var(--green)' : 'var(--red)',
    },
  ];

  const seatRows = [
    { label: t('available'), value: seats?.available || 0, color: 'var(--blue)',  total: seats?.total || 1 },
    { label: t('reserved'),  value: seats?.reserved  || 0, color: 'var(--gold)',  total: seats?.total || 1 },
    { label: t('sold'),      value: seats?.sold      || 0, color: 'var(--t2)',    total: seats?.total || 1 },
    { label: t('refunded'),  value: seats?.refunded  || 0, color: 'var(--red)',   total: seats?.total || 1 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Title row */}
      <div ref={titleRef} className="dash-title-row fade-up">
        <div className="eyebrow">
          <i className="fa-solid fa-chart-pie" style={{ fontSize: '.6rem' }} />
          {t('managerDashboard')}
        </div>
        <div className="h1">{t('managerDashboard')}</div>
        <p className="h-sub">
          <span className="h-sub-dot" />
          {nodeInfo?.nodeName} (#{nodeInfo?.nodeId}) &middot; {t('realtimeUpdate')}
        </p>
      </div>

      {/* KPI row */}
      <div className="dash-kpis" ref={kpiRef}>
        {kpis.map(({ label, value, sub, icon, color, bg, accent }) => (
          <div key={label} className="kpi">
            <div className="kpi-accent" style={{ background: accent }} />
            <div className="kpi-icon" style={{ background: bg }}>
              <i className={`fa-solid ${icon}`} style={{ color }} />
            </div>
            <div className="kpi-val" style={{ color }}>{value}</div>
            <div className="kpi-lbl">{label}</div>
            <div className="kpi-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Middle row */}
      <div className="dash-grid" ref={gridRef}>

        {/* Seat status */}
        <div className="dash-card">
          <div className="dc-head">
            <div className="dc-head-icon">
              <i className="fa-solid fa-grid-2" />
            </div>
            <div className="dc-head-lbl">{t('seatStatus')}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {seatRows.map(({ label, value, color, total }) => (
              <div key={label} className="progress-row">
                <div className="pr-top">
                  <span className="pr-name">{label}</span>
                  <span className="pr-val" style={{ color }}>{value}</span>
                </div>
                <ProgressBar value={value} max={total} color={color} />
              </div>
            ))}
          </div>
        </div>

        {/* Revenue by class */}
        <div className="dash-card">
          <div className="dc-head">
            <div className="dc-head-icon">
              <i className="fa-solid fa-chart-bar" />
            </div>
            <div className="dc-head-lbl">{t('revenueByClass')}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              {
                label: t('firstClass'), icon: 'fa-star', data: revenue?.first_class,
                color: 'var(--gold)', bg: 'var(--gl)', border: 'rgba(240,160,32,.2)'
              },
              {
                label: t('economy'), icon: 'fa-plane', data: revenue?.economy,
                color: 'var(--blue)', bg: 'var(--bl)', border: 'rgba(75,130,255,.2)'
              },
            ].map(({ label, icon, data, color, bg, border }) => (
              <div key={label} className="revenue-block" style={{ background: bg, borderColor: border }}>
                <div className="rb-top">
                  <div className="rb-name" style={{ color }}>
                    <div className="rb-icon" style={{ background: 'rgba(255,255,255,.5)' }}>
                      <i className={`fa-solid ${icon}`} style={{ color, fontSize: '.72rem' }} />
                    </div>
                    {label}
                  </div>
                  <div className="rb-amount" style={{ color }}>
                    ${(data?.total_revenue || 0).toLocaleString()}
                  </div>
                </div>
                <div className="rb-meta">
                  <span>
                    <i className="fa-solid fa-ticket" />
                    {data?.tickets_sold || 0} {t('tickets')}
                  </span>
                  <span>
                    <i className="fa-solid fa-chart-line" />
                    {t('average')} ${(data?.average_price || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="dash-grid">

        {/* Flights */}
        <div className="dash-card">
          <div className="dc-head">
            <div className="dc-head-icon">
              <i className="fa-solid fa-plane-circle-check" />
            </div>
            <div className="dc-head-lbl">{t('flightStatus')}</div>
          </div>
          <div>
            {[
              { label: t('totalFlights'),     value: flights?.total_flights || 0, color: 'var(--text)' },
              { label: t('scheduledFlights'), value: flights?.scheduled     || 0, color: 'var(--blue)' },
              { label: t('upcoming'),         value: flights?.upcoming      || 0, color: 'var(--green)' },
              { label: t('delayed'),          value: flights?.delayed       || 0, color: 'var(--gold)' },
              { label: t('cancelled'),        value: flights?.cancelled     || 0, color: 'var(--red)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flight-stat-row">
                <span className="fsr-lbl">{label}</span>
                <span className="fsr-val" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Vector clock */}
        <div className="dash-card">
          <div className="dc-head">
            <div className="dc-head-icon">
              <i className="fa-solid fa-clock-rotate-left" />
            </div>
            <div className="dc-head-lbl">{t('vectorClock')}</div>
          </div>

          <div className="vc-boxes">
            {Object.entries(vc).map(([node, val]) => (
              <VcBox key={node} node={node} val={val} />
            ))}
          </div>

          <div>
            {[
              { label: t('activeNode'), value: `${nodeInfo?.nodeName} (#${nodeInfo?.nodeId})` },
              { label: t('mode'),       value: sync?.mode || '—' },
              { label: t('lastSync'),   value: sync?.last_sync ? new Date(sync.last_sync).toLocaleString() : 'N/A' },
            ].map(({ label, value }) => (
              <div key={label} className="sync-row">
                <span className="sr-lbl">{label}</span>
                <span className="sr-val">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function VcBox({ node, val }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const t = +val;
    if (isNaN(t)) return;
    gsap.fromTo({ v: 0 }, { v: t }, {
      duration: 1.2,
      delay: 0.7,
      ease: 'power2.out',
      onUpdate: function () {
        if (ref.current) ref.current.textContent = Math.round(this.targets()[0].v);
      }
    });
  }, [val]);
  return (
    <div className="vc-box">
      <div className="vc-val" ref={ref}>0</div>
      <div className="vc-node">{node.replace('_', ' ')}</div>
    </div>
  );
}
