import { Image } from 'common';
import { Show } from 'solid-js';

import brand from '../../../../../site/brand.json';
import styles from './SiteIdentity.module.css';

interface Props {
  logo: string;
  compact?: boolean;
}

// Site identity is kept separate from the reusable landscape navigation.
const SiteIdentity = (props: Props) => (
  <span class={styles.identity} classList={{ [styles.compact]: props.compact }}>
    <Image class={styles.logo} logo={props.logo} name="开源社" height={40} />
    <span class={styles.title}>
      <span lang="zh-CN">{brand.name['zh-CN']}</span>
      <Show when={!props.compact}>
        <span class={styles.subtitle} lang="en">
          {brand.name.en}
        </span>
      </Show>
    </span>
  </span>
);

export default SiteIdentity;
