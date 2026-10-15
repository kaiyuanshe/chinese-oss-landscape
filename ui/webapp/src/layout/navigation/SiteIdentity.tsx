import { Image } from 'common';
import { Show } from 'solid-js';

import brand from '../../../../../site/brand.json';
import { useLocale } from '../stores/locale';
import styles from './SiteIdentity.module.css';

interface Props {
  logo: string;
  compact?: boolean;
}

// Site identity is kept separate from the reusable landscape navigation.
const SiteIdentity = (props: Props) => {
  const { locale } = useLocale();
  const secondaryLocale = () => (locale() === 'zh-CN' ? 'en' : 'zh-CN');

  return (
    <span class={styles.identity} classList={{ [styles.compact]: props.compact }}>
      <Image class={styles.logo} logo={props.logo} name="开源社" height={40} />
      <span class={styles.title}>
        <span lang={locale()}>{brand.name[locale()]}</span>
        <Show when={!props.compact}>
          <span class={styles.subtitle} lang={secondaryLocale()}>
            {brand.name[secondaryLocale()]}
          </span>
        </Show>
      </span>
    </span>
  );
};

export default SiteIdentity;
