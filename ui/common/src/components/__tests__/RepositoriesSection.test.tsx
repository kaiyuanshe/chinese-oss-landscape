import { render } from 'solid-js/web';
import { describe, expect, it, vi } from 'vitest';

import { RepositoriesSection } from '../RepositoriesSection';

vi.mock('solid-styled-components', () => ({ css: () => '' }));

describe('RepositoriesSection in the site profile', () => {
  it('preserves the original repository and license without loading external badges', () => {
    const container = document.createElement('div');
    const dispose = render(
      () => (
        <RepositoriesSection
          repositories={[{ url: 'https://github.com/example/project', primary: true, license: 'Apache-2.0' }]}
        />
      ),
      container
    );

    expect(container.querySelector('a[href="https://github.com/example/project"]')).not.toBeNull();
    expect(container.textContent).toContain('Apache-2.0');
    expect(container.querySelector('img[src*="shields.io"]')).toBeNull();
    expect(container.querySelector('a[href*="/issues?"]')).toBeNull();
    dispose();
  });
});
