import uniq from 'lodash/uniq';
import jsonStableStringify from 'json-stable-stringify';
import personality from '../personalities/goggins.json';
import sites from '../config/sites.json';
import softRoutines from '../soft/routines';

export const defaultConfig = {
  activation: {
    holdSeconds: 3,
    timeSeconds: 5*60,
  },
  sites,
  personality,
  softRoutines,
}

export function enrichConfig(config) {
  const merged = {
    activation: {
      ...defaultConfig.activation,
      ...(config.activation || {}),
    },
    personality: {
      ...defaultConfig.personality,
      ...(config.personality || {}),
    },
  };

  merged.sites = (config && config.sites ? config.sites : defaultConfig.sites);
  merged.softRoutines = (config && config.softRoutines ? config.softRoutines : defaultConfig.softRoutines);

  return {
    config: merged,
    changed: jsonStableStringify(merged) !== jsonStableStringify(config),
  }
}