import React from 'react';
import { useTranslation } from 'react-i18next';

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div style={{
      display: 'flex', gap: '3px',
      background: 'rgba(255,255,255,0.15)',
      borderRadius: '999px', padding: '3px',
    }}>
      {[{ code: 'es', label: 'ES' }, { code: 'en', label: 'EN' }].map(({ code, label }) => {
        const active = i18n.language === code || i18n.language?.startsWith(code);
        return (
          <button
            key={code}
            onClick={() => i18n.changeLanguage(code)}
            style={{
              padding: '5px 14px',
              borderRadius: '999px',
              fontSize: '0.75rem',
              fontWeight: active ? 700 : 500,
              cursor: 'pointer',
              border: 'none',
              transition: 'all 0.18s',
              background: active ? '#ffffff' : 'transparent',
              color: active ? '#3960FB' : 'rgba(255,255,255,0.75)',
              fontFamily: 'inherit',
              letterSpacing: '0.06em',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
