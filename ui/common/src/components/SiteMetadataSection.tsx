import { For, Show } from 'solid-js';

import { useI18n } from '../i18n';
import { SiteItemMetadata } from '../types/types';
import { ExternalLink } from './ExternalLink';

interface Props {
  metadata?: SiteItemMetadata;
}

const regionLabels: Record<string, { 'zh-CN': string; en: string }> = {
  mainland: { 'zh-CN': '中国大陆', en: 'Mainland China' },
  hong_kong: { 'zh-CN': '中国香港', en: 'Hong Kong' },
  macao: { 'zh-CN': '中国澳门', en: 'Macau' },
  taiwan: { 'zh-CN': '中国台湾', en: 'Taiwan' },
};

export const SiteMetadataSection = (props: Props) => {
  const { locale, t } = useI18n();
  const regionName = (region: string): string => regionLabels[region]?.[locale() === 'en' ? 'en' : 'zh-CN'] || region;
  const kindName = () => t(`item.kind.${props.metadata?.kind || 'software'}`);
  const statusName = () => t(`item.status.${props.metadata?.project_status || 'unknown'}`);
  const entryName = (role: string): string => t(`item.entry.${role}`) || role;
  const accessName = (access: string): string => t(`item.${access}`) || access;
  const licenseScopeName = (scope: string): string => t(`item.licenseScope.${scope}`) || scope;
  const licenseStatusName = (status: string): string => {
    const labels: Record<string, { 'zh-CN': string; en: string }> = {
      verified: { 'zh-CN': '已核验', en: 'Verified' },
      in_review: { 'zh-CN': '审核中', en: 'In review' },
      unknown: { 'zh-CN': '未知', en: 'Unknown' },
      not_applicable: { 'zh-CN': '不适用', en: 'Not applicable' },
    };
    return labels[status]?.[locale() === 'en' ? 'en' : 'zh-CN'] || status;
  };
  const standardPolicyStatusName = (status: string): string => {
    const labels: Record<string, { 'zh-CN': string; en: string }> = {
      public: { 'zh-CN': '公开', en: 'Public' },
      restricted: { 'zh-CN': '受限', en: 'Restricted' },
      unknown: { 'zh-CN': '未知', en: 'Unknown' },
      not_applicable: { 'zh-CN': '不适用', en: 'Not applicable' },
    };
    return labels[status]?.[locale() === 'en' ? 'en' : 'zh-CN'] || status;
  };

  return (
    <Show when={props.metadata}>
      <div class="position-relative border p-3 mt-4">
        <div class="position-absolute px-2 bg-white fw-semibold" style={{ top: '-0.55rem', left: '1rem' }}>
          {t('item.origin')} / {t('item.affiliation')}
        </div>

        <div class="d-flex flex-wrap gap-2 mb-3">
          <span class="badge rounded-0 border text-dark">{kindName()}</span>
          <span class="badge rounded-0 border text-dark">
            {t('item.projectStatus')}: {statusName()}
          </span>
          <Show when={props.metadata!.publication_status === 'needs_review'}>
            <span class="badge rounded-0 border border-warning text-warning-emphasis">
              {t('item.publicationStatus')}: {t('item.needsReview')}
            </span>
          </Show>
          <Show when={props.metadata!.status_checked_at}>
            <span class="badge rounded-0 border text-dark">
              {t('item.checkedAt')}: {props.metadata!.status_checked_at}
            </span>
          </Show>
        </div>

        <Show when={props.metadata!.status_evidence.length > 0}>
          <div class="mb-3">
            <div class="fw-semibold mb-1">{t('item.evidence')}</div>
            <For each={props.metadata!.status_evidence}>
              {(evidence) => (
                <ExternalLink class="d-block text-muted small" href={evidence.url}>
                  {evidence.title}
                </ExternalLink>
              )}
            </For>
          </div>
        </Show>

        <Show when={props.metadata!.origin}>
          <div class="mb-3">
            <div class="fw-semibold mb-1">{t('item.origin')}</div>
            <div>{props.metadata!.origin!.regions.map(regionName).join(locale() === 'en' ? ', ' : '、')}</div>
            <div class="text-muted mt-1">{props.metadata!.origin!.statement}</div>
            <small class="text-muted">
              {t('item.checkedAt')}: {props.metadata!.origin!.checked_at}
            </small>
            <Show when={props.metadata!.origin!.evidence.length > 0}>
              <div class="mt-2">
                <small class="fw-semibold d-block">{t('item.evidence')}</small>
                <For each={props.metadata!.origin!.evidence}>
                  {(evidence) => (
                    <ExternalLink class="d-block text-muted small" href={evidence.url}>
                      {evidence.title}
                    </ExternalLink>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>

        <Show when={props.metadata!.affiliation}>
          <div class="mb-3">
            <div class="fw-semibold mb-1">{t('item.affiliation')}</div>
            <Show when={props.metadata!.affiliation!.current_maintainer}>
              <div>
                <span class="text-muted me-2">{t('item.maintainer')}:</span>
                <Show
                  when={props.metadata!.affiliation!.current_maintainer!.url}
                  fallback={props.metadata!.affiliation!.current_maintainer!.name}
                >
                  <ExternalLink href={props.metadata!.affiliation!.current_maintainer!.url!}>
                    {props.metadata!.affiliation!.current_maintainer!.name}
                  </ExternalLink>
                </Show>
              </div>
            </Show>
            <Show when={props.metadata!.affiliation!.current_foundation}>
              <div>
                <span class="text-muted me-2">{t('item.foundation')}:</span>
                <Show
                  when={props.metadata!.affiliation!.current_foundation!.url}
                  fallback={props.metadata!.affiliation!.current_foundation!.name}
                >
                  <ExternalLink href={props.metadata!.affiliation!.current_foundation!.url!}>
                    {props.metadata!.affiliation!.current_foundation!.name}
                  </ExternalLink>
                </Show>
              </div>
            </Show>
            <small class="text-muted">
              {t('item.checkedAt')}: {props.metadata!.affiliation!.as_of}
            </small>
          </div>
        </Show>

        <Show when={props.metadata!.entries.length > 0}>
          <div class="mb-3">
            <div class="fw-semibold mb-1">{t('item.sources')}</div>
            <div class="d-flex flex-column gap-1">
              <For each={props.metadata!.entries}>
                {(entry) => (
                  <div class="d-flex flex-wrap align-items-baseline gap-2">
                    <ExternalLink href={entry.url}>{entry.title || entryName(entry.role)}</ExternalLink>
                    <small class="text-muted">
                      {entry.primary ? `(${t('item.primary')})` : ''} {accessName(entry.access)}
                    </small>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        <Show when={props.metadata!.licenses.length > 0}>
          <div>
            <div class="fw-semibold mb-1">{t('item.license')}</div>
            <For each={props.metadata!.licenses}>
              {(license) => (
                <div class="small text-muted">
                  {license.identifier || t('item.notApplicable')} · {licenseScopeName(license.scope)} ·{' '}
                  {t('item.licenseStatus')}: {licenseStatusName(license.status)}
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={props.metadata!.standard_policy}>
          <div class="mt-3">
            <div class="fw-semibold mb-1">{t('item.standardPolicy')}</div>
            <div class="small text-muted">
              {t('item.standardPolicyStatus')}: {standardPolicyStatusName(props.metadata!.standard_policy!.status)}
            </div>
            <Show when={props.metadata!.standard_policy!.evidence.length > 0}>
              <For each={props.metadata!.standard_policy!.evidence}>
                {(evidence) => (
                  <ExternalLink class="d-block text-muted small" href={evidence.url}>
                    {evidence.title}
                  </ExternalLink>
                )}
              </For>
            </Show>
          </div>
        </Show>
      </div>
    </Show>
  );
};
