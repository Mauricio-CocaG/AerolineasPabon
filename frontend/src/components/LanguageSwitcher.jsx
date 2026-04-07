import React from 'react';
import { useTranslation } from 'react-i18next';

function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };
  
  return (
    <div className="flex gap-2">
      <button
        onClick={() => changeLanguage('es')}
        className={'px-2 py-1 rounded ' + (i18n.language === 'es' ? 'bg-white text-airline-blue' : 'bg-airline-blue text-white border border-white')}
      >
        🇪🇸 ES
      </button>
      <button
        onClick={() => changeLanguage('en')}
        className={'px-2 py-1 rounded ' + (i18n.language === 'en' ? 'bg-white text-airline-blue' : 'bg-airline-blue text-white border border-white')}
      >
        🇬🇧 EN
      </button>
    </div>
  );
}

export default LanguageSwitcher;