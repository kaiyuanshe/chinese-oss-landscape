import { A } from '@solidjs/router';
import { SVGIcon, SVGIconKind, useI18n } from 'common';

import { EXPLORE_PATH } from '../../data';
import Footer from '../navigation/Footer';
import styles from './NotFound.module.css';

const NotFound = () => {
  const { t } = useI18n();
  return (
    <>
      <main
        role="main"
        class="container-lg flex-grow-1 p-5 d-flex flex-column align-items-center justify-content-center"
      >
        <div class={`m-3 ${styles.icon}`}>
          <SVGIcon kind={SVGIconKind.Warning} />
        </div>
        <div class="h1 text-center mb-4">{t('error.pageNotFound')}</div>
        <div class="h3 text-center mb-5">{t('error.pageNotFoundDetails')}</div>
        <A
          href={EXPLORE_PATH}
          class="btn btn-primary rounded-0 text-white btn-lg text-decoration-none"
          aria-label={t('error.backHome')}
        >
          {t('error.backHome')}
        </A>
      </main>
      <Footer />
    </>
  );
};

export default NotFound;
