import { isUndefined } from 'lodash';

const prepareLink = (path: string, extraQuery?: string): string => {
  return `${path}${!isUndefined(extraQuery) ? `${path.endsWith('/') ? '' : '/'}?${extraQuery}` : ''}`;
};

export default prepareLink;
