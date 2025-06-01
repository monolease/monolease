import {describe, expect, it} from 'vitest';
import {parseReleaseTags, getLatestReleaseTag} from './tags.js';
import type {ReleaseTag} from '../types.js';
import semver, {type SemVer} from 'semver';

function parseVersion(version: string): SemVer {
  const parsed = semver.parse(version);
  if (!parsed) {
    throw new Error(`Invalid semver version: ${version}`);
  }
  return parsed;
}

describe('parseReleaseTags', () => {
  it('should parse and return release tags', () => {
    const rawTags: string[] = [
      'a@1.0.0',
      'a@1.0.0-beta',
      'b@invalidversion',
      'random-tag',
      '@my-scope/package@1.0.0',
    ];
    const expectedTags: ReleaseTag[] = [
      {
        raw: 'a@1.0.0',
        version: parseVersion('1.0.0'),
        packageName: 'a',
      },
      {
        raw: 'a@1.0.0-beta',
        version: parseVersion('1.0.0-beta'),
        packageName: 'a',
      },
      {
        raw: '@my-scope/package@1.0.0',
        version: parseVersion('1.0.0'),
        packageName: '@my-scope/package',
      },
    ];
    expect(parseReleaseTags(rawTags)).toStrictEqual(expectedTags);
  });
});

describe('getLatestReleaseTag', () => {
  const tags: ReleaseTag[] = [
    {
      raw: 'pkg-a@1.0.0',
      packageName: 'pkg-a',
      version: parseVersion('1.0.0'),
    },
    {
      raw: 'pkg-a@2.0.0',
      packageName: 'pkg-a',
      version: parseVersion('2.0.0'),
    },
    {
      raw: 'pkg-a@2.1.0-beta.1',
      packageName: 'pkg-a',
      version: parseVersion('2.1.0-beta.1'),
    },
    {
      raw: 'pkg-a@2.1.0-beta.2',
      packageName: 'pkg-a',
      version: parseVersion('2.1.0-beta.2'),
    },
    {
      raw: 'pkg-b@1.0.0',
      packageName: 'pkg-b',
      version: parseVersion('1.0.0'),
    },
  ];

  it('should return null when no matching package is found', () => {
    expect(
      getLatestReleaseTag({
        packageName: 'non-existent',
        tags,
      }),
    ).toBeUndefined();
  });

  it('should return the latest non-prerelease version', () => {
    expect(
      getLatestReleaseTag({
        packageName: 'pkg-a',
        tags,
      }),
    ).toStrictEqual(tags[1]); // pkg-a@2.0.0
  });

  it('should return null when no non-prerelease versions exist', () => {
    const onlyPrereleases: ReleaseTag[] = tags.filter(
      t => t.packageName === 'pkg-a' && t.version.prerelease.length > 0,
    );
    expect(
      getLatestReleaseTag({
        packageName: 'pkg-a',
        tags: onlyPrereleases,
      }),
    ).toBeUndefined();
  });

  it('should return the latest matching prerelease version', () => {
    expect(
      getLatestReleaseTag({
        packageName: 'pkg-a',
        tags,
        prereleaseIdentifier: 'beta',
      }),
    ).toStrictEqual(tags[3]); // pkg-a@2.1.0-beta.2
  });

  it('should return null when no matching prerelease versions exist', () => {
    expect(
      getLatestReleaseTag({
        packageName: 'pkg-a',
        tags,
        prereleaseIdentifier: 'alpha',
      }),
    ).toBeUndefined();
  });
});
