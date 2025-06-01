import semver from 'semver';
import {tagSeparator} from '../constants.js';
import type {Config, ReleaseTag} from '../types.js';
import type {addWorkspaceDeps} from './pkgJson.js';
import type {addNextVersions} from './semver.js';
import {createTag, pushTag} from './git.js';

export function parseReleaseTags(rawTags: string[]) {
  const releaseTags: ReleaseTag[] = [];
  for (const rawTag of rawTags) {
    // package names might begin with @ if scoped, hence using lastIndexOf
    const seperatorIndex = rawTag.lastIndexOf(tagSeparator);
    if (seperatorIndex !== -1) {
      const packageName = rawTag.substring(0, seperatorIndex);
      const version = rawTag.substring(seperatorIndex + 1);
      const parsedVersion = semver.parse(version);
      if (parsedVersion) {
        releaseTags.push({
          raw: rawTag,
          version: parsedVersion,
          packageName,
        });
      }
    }
  }

  return releaseTags;
}

interface GetLatestReleaseTagOptions {
  tags: ReleaseTag[];
  packageName: string;
  /**
   * If provided, will find the latest tag that matches the given prerelease identifier
   * else will return the latest tag withouth a prerelease identifier
   */
  prereleaseIdentifier?: string | undefined;
}

export function getLatestReleaseTag({
  packageName,
  tags,
  prereleaseIdentifier,
}: GetLatestReleaseTagOptions) {
  let latestTag: ReleaseTag | undefined = undefined;
  for (const tag of tags) {
    if (tag.packageName === packageName) {
      if (prereleaseIdentifier) {
        if (tag.version.prerelease[0] === prereleaseIdentifier) {
          if (
            !latestTag ||
            semver.gt(tag.version.version, latestTag.version.version)
          ) {
            latestTag = tag;
          }
        }
      } else {
        if (
          !tag.version.prerelease.length &&
          (!latestTag ||
            semver.gt(tag.version.version, latestTag.version.version))
        ) {
          latestTag = tag;
        }
      }
    }
  }
  return latestTag;
}

export function getLatestReleaseTagOf(a?: ReleaseTag, b?: ReleaseTag) {
  if (!a) {
    return b;
  }
  if (!b) {
    return a;
  }
  return semver.gt(a.version, b.version) ? a : b;
}

interface AddLatestTagsOptions {
  workspaces: Awaited<ReturnType<typeof addWorkspaceDeps>>;
  releaseTags: ReleaseTag[];
  config: Config;
}

export function addLatestTags({
  config,
  releaseTags,
  workspaces,
}: AddLatestTagsOptions) {
  return workspaces.map(workspace => {
    const latestStableVersion = getLatestReleaseTag({
      packageName: workspace.pkgJson.name,
      tags: releaseTags,
    });
    let latestPrereleaseVersion: ReleaseTag | undefined;
    if (config.prerelease?.identifier) {
      latestPrereleaseVersion = getLatestReleaseTag({
        packageName: workspace.pkgJson.name,
        tags: releaseTags,
        prereleaseIdentifier: config.prerelease.identifier,
      });
    }

    const latestOverAllVersion = getLatestReleaseTagOf(
      latestStableVersion,
      latestPrereleaseVersion,
    );

    return {
      ...workspace,
      latestVersion: {
        stable: latestStableVersion,
        prerelease: latestPrereleaseVersion,
        overall: latestOverAllVersion,
      },
    };
  });
}

interface CreateTagsParams {
  workspaces: ReturnType<typeof addNextVersions>;
  pushTags: boolean;
  dryRun: boolean;
  cwd?: string;
}

export function createTags({
  workspaces,
  cwd,
  pushTags,
  dryRun,
}: CreateTagsParams) {
  return Promise.all(
    workspaces.map(async workspace => {
      let createdTag: string | undefined;
      if (workspace.nextVersion && !dryRun) {
        const tagName = `${workspace.name}${tagSeparator}${workspace.nextVersion.raw}`;
        await createTag({name: tagName, message: ''}, cwd);
        createdTag = tagName;
        if (pushTags) {
          await pushTag(tagName, cwd);
        }
      }

      return {
        ...workspace,
        createdTag,
      };
    }),
  );
}
