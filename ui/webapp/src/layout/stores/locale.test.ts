import { describe, expect, it } from 'vitest';

import { getInitialLocale, parseLocale } from '../../utils/localeUtils';

describe('locale selection', () => {
  it('prefers a supported URL locale over the stored preference', () => {
    expect(getInitialLocale('?lang=en', 'zh-CN')).toBe('en');
  });

  it('uses the stored preference when the URL does not specify a locale', () => {
    expect(getInitialLocale('?item=apache-dubbo', 'en')).toBe('en');
  });

  it('defaults to Chinese and rejects unsupported values', () => {
    expect(getInitialLocale('', null)).toBe('zh-CN');
    expect(parseLocale('fr')).toBeUndefined();
    expect(getInitialLocale('?lang=fr', 'en')).toBe('en');
  });
});
