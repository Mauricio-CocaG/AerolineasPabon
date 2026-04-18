import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { gsap } from 'gsap';

/* ── Animated progress bar ─────────────────────────── */
function ProgressBar({ value, max, color }) {
  const fillRef = useRef(null);
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  useEffect(() => {
    if (fillRef.current)
      gsap.fromTo(fillRef.current,
        { width: '0%' },
        { width: pct + '%', duration: 1.2, ease: 'power2.out', delay: 0.5 }
      );
  }, [pct]);
  return (
    <div className="progress-track">
      <div ref={fillRef} className="progress-fill" style={{ width: '0%', background: color }} />
    </div>
  );
}

/* ── Count-up number ────────────────────────────────── */
function AnimatedVal({ value, prefix = '', suffix = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const num = parseFloat(String(value).replace(/[^0-9.]/g, ''));
    if (isNaN(num)) { ref.current.textContent = prefix + value + suffix; return; }
    gsap.fromTo({ v: 0 }, { v: num }, {
      duration: 1.3, ease: 'power2.out', delay: 0.12,
      onUpdate: function () {
        if (ref.current) {
          const rounded = Number.isInteger(num)
            ? Math.round(this.targets()[0].v)
            : this.targets()[0].v.toFixed(2);
          ref.current.textContent = prefix + rounded.toLocaleString() + suffix;
        }
      },
    });
  }, [value]);
  return <span ref={ref}>{prefix}{value}{suffix}</span>;
}

/* ── Vector clock box ───────────────────────────────── */
function VcBox({ node, val, delay = 0 }) {
  const ref    = useRef(null);
  const boxRef = useRef(null);
  useEffect(() => {
    if (boxRef.current)
      gsap.fromTo(boxRef.current,
        { opacity: 0, scale: 0.75, y: 12 },
        { opacity: 1, scale: 1,    y: 0, duration: 0.4, ease: 'back.out(1.8)', delay }
      );
    if (!ref.current) return;
    const t = +val;
    if (isNaN(t)) return;
    gsap.fromTo({ v: 0 }, { v: t }, {
      duration: 1.2, delay: delay + 0.25, ease: 'power2.out',
      onUpdate: function () {
        if (ref.current) ref.current.textContent = Math.round(this.targets()[0].v);
      },
    });
  }, [val]);
  return (
    <div className="vc-box" ref={boxRef}>
      <div className="vc-val" ref={ref}>0</div>
      <div className="vc-node">{node.replace('_', ' ')}</div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════════════════ */
export default function Dashboard({ data }) {
  const { t } = useTranslation();
  const { sales, seats, flights, sync, nodeInfo, revenue } = data;
  const vc = nodeInfo?.vectorClock || {};

  const titleRef      = useRef(null);
  const kpiRef        = useRef(null);
  const topGridRef    = useRef(null);
  const bottomGridRef = useRef(null);
  const containerRef  = useRef(null);

  /* ── entrance animations ── */
  useEffect(() => {
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

    if (titleRef.current)
      tl.fromTo(titleRef.current.children,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.08 }
      );

    if (kpiRef.current)
      tl.fromTo(kpiRef.current.querySelectorAll('.kpi'),
        { opacity: 0, y: 28, scale: 0.92 },
        { opacity: 1, y: 0,  scale: 1, duration: 0.45, stagger: 0.08, ease: 'back.out(1.5)' },
        '-=0.2'
      );

    if (topGridRef.current)
      tl.fromTo(topGridRef.current.querySelectorAll('.dash-card'),
        { opacity: 0, y: 22, scale: 0.97 },
        { opacity: 1, y: 0,  scale: 1, duration: 0.4, stagger: 0.1, ease: 'back.out(1.2)' },
        '-=0.25'
      );

    if (bottomGridRef.current)
      tl.fromTo(bottomGridRef.current.querySelectorAll('.dash-card'),
        { opacity: 0, y: 22, scale: 0.97 },
        { opacity: 1, y: 0,  scale: 1, duration: 0.4, stagger: 0.1, ease: 'back.out(1.2)' },
        '-=0.3'
      );
  }, []);

  /* ── hover effects on cards & KPIs ── */
  useEffect(() => {
    if (!containerRef.current) return;

    const addHover = (selector, enterProps, leaveProps) => {
      containerRef.current.querySelectorAll(selector).forEach(el => {
        const enter = () => gsap.to(el, { ...enterProps, duration: 0.22, ease: 'power2.out', overwrite: 'auto' });
        const leave = () => gsap.to(el, { ...leaveProps, duration: 0.28, ease: 'power2.out', overwrite: 'auto' });
        el.addEventListener('mouseenter', enter);
        el.addEventListener('mouseleave', leave);
        el._dashCleanup = () => {
          el.removeEventListener('mouseenter', enter);
          el.removeEventListener('mouseleave', leave);
        };
      });
    };

    addHover('.kpi',
      { y: -6, scale: 1.025, boxShadow: '0 18px 44px rgba(0,0,0,0.25)' },
      { y:  0, scale: 1,     boxShadow: '' }
    );
    addHover('.dash-card',
      { y: -4, boxShadow: '0 20px 48px rgba(0,0,0,0.22)' },
      { y:  0, boxShadow: '' }
    );
    addHover('.flight-stat-row',
      { x: 6,  opacity: 1 },
      { x: 0,  opacity: 1 }
    );

    return () => {
      containerRef.current?.querySelectorAll('.kpi,.dash-card,.flight-stat-row').forEach(el => {
        el._dashCleanup?.();
      });
    };
  }, [data]);

  /* ── sync pulse ── */
  useEffect(() => {
    if (!containerRef.current) return;
    const dot = containerRef.current.querySelector('.kpi-accent');
    if (dot && sync?.is_healthy) {
      gsap.to(dot, {
        opacity: 0.35, scale: 1.4,
        duration: 1.1, repeat: -1, yoyo: true, ease: 'sine.inOut',
      });
    }
  }, [sync]);

  const kpis = [
    { label: t('totalRevenue'),  value: sales?.total_revenue_formatted || '$0.00',
      sub: `${sales?.total_sales || 0} ${t('sales')}`,
      icon: 'fa-dollar-sign', color: 'var(--blue)',  bg: 'var(--bl)', accent: 'var(--blue)' },
    { label: t('occupancyRate'), value: (seats?.sold_percentage || 0) + '%',
      sub: `${seats?.sold || 0} ${t('soldSeats')}`,
      icon: 'fa-chair', color: 'var(--green)', bg: 'rgba(34,200,128,.1)', accent: 'var(--green)' },
    { label: t('totalSales'),    value: String(sales?.total_sales || 0),
      sub: `${sales?.unique_passengers || 0} ${t('uniquePassengers')}`,
      icon: 'fa-ticket', color: '#A855F7', bg: 'rgba(168,85,247,.1)', accent: '#A855F7' },
    { label: t('syncStatus'),    value: sync?.is_healthy ? t('active') : t('offline'),
      sub: sync?.mode || '—',
      icon: sync?.is_healthy ? 'fa-circle-check' : 'fa-circle-xmark',
      color:  sync?.is_healthy ? 'var(--green)' : 'var(--red)',
      bg:     sync?.is_healthy ? 'rgba(34,200,128,.1)' : 'rgba(255,80,80,.1)',
      accent: sync?.is_healthy ? 'var(--green)' : 'var(--red)' },
  ];

  const seatRows = [
    { label: t('available'), value: seats?.available || 0, color: 'var(--blue)',  total: seats?.total || 1 },
    { label: t('reserved'),  value: seats?.reserved  || 0, color: 'var(--gold)',  total: seats?.total || 1 },
    { label: t('sold'),      value: seats?.sold      || 0, color: 'var(--t2)',    total: seats?.total || 1 },
    { label: t('refunded'),  value: seats?.refunded  || 0, color: 'var(--red)',   total: seats?.total || 1 },
  ];

  const flightStats = [
    { label: t('totalFlights'),     value: flights?.total_flights || 0, color: 'var(--text)' },
    { label: t('scheduledFlights'), value: flights?.scheduled     || 0, color: 'var(--blue)' },
    { label: t('upcoming'),         value: flights?.upcoming      || 0, color: 'var(--green)' },
    { label: t('delayed'),          value: flights?.delayed       || 0, color: 'var(--gold)' },
    { label: t('cancelled'),        value: flights?.cancelled     || 0, color: 'var(--red)' },
  ];

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Title row */}
      <div ref={titleRef} className="dash-title-row">
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
            <div className="kpi-val" style={{ color }}>
              {label === t('occupancyRate')
                ? <AnimatedVal value={seats?.sold_percentage || 0} suffix="%" />
                : label === t('totalSales')
                ? <AnimatedVal value={sales?.total_sales || 0} />
                : value
              }
            </div>
            <div className="kpi-lbl">{label}</div>
            <div className="kpi-sub">{sub}</div>
          </div>
        ))}
      </div>

      {/* Top grid row */}
      <div className="dash-grid" ref={topGridRef}>

        {/* Seat status */}
        <div className="dash-card">
          <div className="dc-head">
            <div className="dc-head-icon"><i className="fa-solid fa-grid-2" /></div>
            <div className="dc-head-lbl">{t('seatStatus')}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {seatRows.map(({ label, value, color, total }) => (
              <div key={label} className="progress-row">
                <div className="pr-top">
                  <span className="pr-name">{label}</span>
                  <span className="pr-val" style={{ color }}>
                    <AnimatedVal value={value} />
                  </span>
                </div>
                <ProgressBar value={value} max={total} color={color} />
              </div>
            ))}
          </div>
        </div>

        {/* Revenue by class */}
        <div className="dash-card">
          <div className="dc-head">
            <div className="dc-head-icon"><i className="fa-solid fa-chart-bar" /></div>
            <div className="dc-head-lbl">{t('revenueByClass')}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: t('firstClass'), icon: 'fa-star',  data: revenue?.first_class,
                color: 'var(--gold)', bg: 'var(--gl)', border: 'rgba(240,160,32,.2)' },
              { label: t('economy'),    icon: 'fa-plane', data: revenue?.economy,
                color: 'var(--blue)', bg: 'var(--bl)', border: 'rgba(75,130,255,.2)' },
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
                    $<AnimatedVal value={data?.total_revenue || 0} />
                  </div>
                </div>
                <div className="rb-meta">
                  <span>
                    <i className="fa-solid fa-ticket" />
                    <AnimatedVal value={data?.tickets_sold || 0} suffix={` ${t('tickets')}`} />
                  </span>
                  <span>
                    <i className="fa-solid fa-chart-line" />
                    {t('average')} $<AnimatedVal value={data?.average_price || 0} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom grid row */}
      <div className="dash-grid" ref={bottomGridRef}>

        {/* Flights */}
        <div className="dash-card">
          <div className="dc-head">
            <div className="dc-head-icon"><i className="fa-solid fa-plane-circle-check" /></div>
            <div className="dc-head-lbl">{t('flightStatus')}</div>
          </div>
          <div>
            {flightStats.map(({ label, value, color }) => (
              <div key={label} className="flight-stat-row">
                <span className="fsr-lbl">{label}</span>
                <span className="fsr-val" style={{ color }}>
                  <AnimatedVal value={value} />
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Vector clock */}
        <div className="dash-card">
          <div className="dc-head">
            <div className="dc-head-icon"><i className="fa-solid fa-clock-rotate-left" /></div>
            <div className="dc-head-lbl">{t('vectorClock')}</div>
          </div>

          <div className="vc-boxes">
            {Object.entries(vc).map(([node, val], i) => (
              <VcBox key={node} node={node} val={val} delay={i * 0.1} />
            ))}
          </div>

          <div>
            {[
              { label: t('activeNode'), value: `${nodeInfo?.nodeName} (#${nodeInfo?.nodeId})` },
              { label: t('mode'),       value: sync?.mode || '—' },
              { label: t('lastSync'),   value: sync?.last_sync
                  ? new Date(sync.last_sync).toLocaleString() : 'N/A' },
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
