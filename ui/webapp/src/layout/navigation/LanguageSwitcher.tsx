import { useI18n } from 'common';

import { useLocale } from '../stores/locale';

const LanguageSwitcher = () => {
  const { locale, setLocale } = useLocale();
  const { t } = useI18n();

  const nextLocale = () => (locale() === 'zh-CN' ? 'en' : 'zh-CN');

  return (
    <button
      type="button"
      class="btn btn-link text-dark text-decoration-none px-2"
      onClick={() => setLocale(nextLocale())}
      aria-label={locale() === 'zh-CN' ? t('language.switchToEnglish') : t('language.switchToChinese')}
      title={locale() === 'zh-CN' ? t('language.switchToEnglish') : t('language.switchToChinese')}
    >
      {locale() === 'zh-CN' ? 'EN' : '中'}
    </button>
  );
};

export default LanguageSwitcher;
