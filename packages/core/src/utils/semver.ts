import type {Config} from '../types.js';
import type {addBumpedWorkspaceDeps} from './workspaces.js';
import semver, {type ReleaseType, type SemVer} from 'semver';

/**
 * Returns whether the version is a patch, minor, or major version.
 */
function getVersionType(version: SemVer) {
  if (version.patch > 0) {
    return 'patch';
  }
  if (version.minor > 0) {
    return 'minor';
  }
  return 'major';
}

interface CalculateNextVersionOptions {
  workspace: Awaited<ReturnType<typeof addBumpedWorkspaceDeps>>[number];
  onStableBranch: boolean;
  prereleaseIdentifier?: string | undefined;
}

function calculateNextVersion({
  onStableBranch,
  workspace,
  prereleaseIdentifier,
}: CalculateNextVersionOptions) {
  // on the prerelease branch,
  // use commits since the latest prerelease version for changelog and bump type
  // but use the latest version of either stable or prerelease as the base version
  // for determining the next version
  let nextVersionString: string | null = null;
  if (workspace.bumpLevel || workspace.bumpedWorkspaceDependencies.length) {
    let _bumpLevel: ReleaseType = workspace.bumpLevel ?? 'patch';
    if (onStableBranch) {
      const base = workspace.latestVersion.stable?.version;
      nextVersionString = base ? semver.inc(base, _bumpLevel) : '1.0.0';
    } else {
      if (!prereleaseIdentifier) {
        throw new Error('prerelease identifier is required');
      }
      let shouldPrereleaseBump = false;
      const base = workspace.latestVersion.overall?.version;
      if (
        base &&
        workspace.latestVersion.overall?.version.raw ===
          workspace.latestVersion.prerelease?.version.raw
      ) {
        // if we are already on a prerelease version and the range satisfies the bump type,
        // bump the prerelease part of the version
        const baseVersionType = getVersionType(base);
        if (_bumpLevel === 'patch') {
          shouldPrereleaseBump = true;
        } else if (_bumpLevel === 'minor' && baseVersionType !== 'patch') {
          shouldPrereleaseBump = true;
        } else if (_bumpLevel === 'major' && baseVersionType === 'major') {
          shouldPrereleaseBump = true;
        }
      }
      _bumpLevel = shouldPrereleaseBump ? 'prerelease' : `pre${_bumpLevel}`;
      nextVersionString =
        base ?
          semver.inc(base, _bumpLevel, prereleaseIdentifier)
        : `1.0.0-${prereleaseIdentifier}.0`;
    }
  }
  const nextVersion =
    nextVersionString ? semver.parse(nextVersionString) : null;

  return nextVersion ?? undefined;
}

interface AddNextVersionsOptions {
  workspaces: Awaited<ReturnType<typeof addBumpedWorkspaceDeps>>;
  onStableBranch: boolean;
  config: Config;
}

export function addNextVersions({
  onStableBranch,
  workspaces,
  config,
}: AddNextVersionsOptions) {
  return workspaces.map(workspace => {
    const nextVersion = calculateNextVersion({
      onStableBranch,
      workspace,
      prereleaseIdentifier: config.prerelease?.identifier,
    });
    return {
      ...workspace,
      nextVersion,
    };
  });
}
