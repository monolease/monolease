import type {PackageManager} from '../types.js';

export function getLockfileName(packageManager: PackageManager) {
  switch (packageManager) {
    case 'pnpm':
      return 'pnpm-lock.yaml';
    case 'npm':
      return 'package-lock.json';
    case 'yarn':
      return 'yarn.lock';
    default:
      packageManager satisfies never;
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Unsupported package manager: ${packageManager}`);
  }
}
