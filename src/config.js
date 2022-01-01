import uniq from 'lodash/uniq';
import jsonStableStringify from 'json-stable-stringify';
import personality from '../personalities/goggins.json';
import sites from '../config/sites.json';

export const defaultConfig = {
  activation: {
    holdSeconds: 5,
    timeSeconds: 5*60,
  },
  sites,
  personality,
}

export function enrichConfig(config) {
  const merged = {
    personality: {
      ...defaultConfig.personality,
      ...(config.personality || {}),
    },
    activation: {
      ...defaultConfig.activation,
      ...(config.activation || {}),
    },
  };

  merged.sites = (config && config.sites ? config.sites : defaultConfig.sites);

  return {
    config: merged,
    changed: jsonStableStringify(merged) !== jsonStableStringify(config),
  }
}