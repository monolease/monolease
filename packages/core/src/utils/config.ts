import type {Config} from '../types.js';

interface ValidateConfigParams {
  config: Config;
  currentBranch: string;
}

export function validateConfig({config, currentBranch}: ValidateConfigParams) {
  // ensure that the current branch is present in the config
  if (
    currentBranch !== config.stable.branch &&
    currentBranch !== config.prerelease?.branch
  ) {
    throw new Error(`Current branch ${currentBranch} not found in config`);
  }
}
