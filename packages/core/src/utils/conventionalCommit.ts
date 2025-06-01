import type {addLatestTags} from './tags.js';
import {listCommits} from './git.js';
import type {ReleaseType} from 'semver';
import type {
  Commit,
  ConventionalCommit,
  ConventionalCommitSubject,
} from '../types.js';
import {parseConventionalCommitSubject} from './parsers.js';

export const subjectRegex =
  /^(?<type>feat|fix)(\((?<scope>.+)\))?((?<breaking>!))?: (?<description>.+)$/;

export const breakingChangeFooterRegex =
  /(?:\n\n)?(BREAKING[ -]CHANGE(: | #))(?<description>(?:(?!\n\n[\w-]+(?:: | #)).)*)/s;

/**
 * Parses the subject of a commit message
 * and returns an object with the type, scope, description, and breaking change status.
 * if the subject matches the conventional commit format.
 */
function parseSubject(subject: string): ConventionalCommitSubject | undefined {
  const execResult = subjectRegex.exec(subject);
  try {
    const parsed = parseConventionalCommitSubject({
      ...execResult?.groups,
      breaking: execResult?.groups?.breaking === '!',
    });
    return parsed;
  } catch {
    return undefined;
  }
}

/**
 * Parses the body of a commit message and returns the breaking change description if present.
 */
function parseBreakingChangeDescription(body: string) {
  const execResult = breakingChangeFooterRegex.exec(body);
  return execResult?.groups?.description;
}

/**
 * Given an array of commits, parses and returns the ones that match the conventional commit format.
 */
export function parseConventionalCommits(
  commits: Commit[],
): ConventionalCommit[] {
  const conventionalCommits: ConventionalCommit[] = [];
  for (const commit of commits) {
    const parsedSubject = parseSubject(commit.subject);
    if (parsedSubject) {
      conventionalCommits.push({
        abbrevHash: commit.abbrevHash,
        subject: parsedSubject,
        body: {
          breakingChangeDescription:
            commit.body ?
              parseBreakingChangeDescription(commit.body)
            : undefined,
        },
      });
    }
  }

  return conventionalCommits;
}

export function calculateSemverIncLevel(
  commits: ConventionalCommit[],
): Extract<ReleaseType, 'major' | 'minor' | 'patch'> | undefined {
  // todo: don't iterate the commits three times
  const hasBreakingChange = commits.some(
    commit => commit.subject.breaking || commit.body?.breakingChangeDescription,
  );
  const hasFeature = commits.some(commit => commit.subject.type === 'feat');
  const hasFix = commits.some(commit => commit.subject.type === 'fix');

  if (hasBreakingChange) {
    return 'major';
  } else if (hasFeature) {
    return 'minor';
  } else if (hasFix) {
    return 'patch';
  }

  return undefined;
}

interface AddConventionalCommitsOptions {
  workspaces: Awaited<ReturnType<typeof addLatestTags>>;
  cwd?: string;
}

export async function addConventionalCommits({
  workspaces,
  cwd,
}: AddConventionalCommitsOptions) {
  return Promise.all(
    workspaces.map(async workspace => {
      const commitsSinceLatestPrerelease = await listCommits(
        {
          paths: [workspace.dir],
          revisionRange:
            workspace.latestVersion.prerelease?.raw ?
              `${workspace.latestVersion.prerelease.raw}..HEAD`
            : undefined,
        },
        cwd,
      );

      const commitsSinceLatestStable = await listCommits(
        {
          paths: [workspace.dir],
          revisionRange:
            workspace.latestVersion.stable?.raw ?
              `${workspace.latestVersion.stable.raw}..HEAD`
            : undefined,
        },
        cwd,
      );

      return {
        ...workspace,
        commits: {
          sinceLatestPrelease: parseConventionalCommits(
            commitsSinceLatestPrerelease,
          ),
          sinceLatestStable: parseConventionalCommits(commitsSinceLatestStable),
        },
      };
    }),
  );
}

interface AddBumpLevelsOptions {
  workspaces: Awaited<ReturnType<typeof addConventionalCommits>>;
  onStableBranch: boolean;
}
export function addBumpLevels({
  workspaces,
  onStableBranch,
}: AddBumpLevelsOptions) {
  return workspaces.map(workspace => {
    let bumpLevel: ReleaseType | undefined;
    if (onStableBranch) {
      bumpLevel = calculateSemverIncLevel(workspace.commits.sinceLatestStable);
    } else {
      // only consider commits that are not already released on stable
      const filteredCommits = workspace.commits.sinceLatestPrelease.filter(
        commit =>
          workspace.commits.sinceLatestStable.some(
            stableCommit => stableCommit.abbrevHash === commit.abbrevHash,
          ),
      );
      if (
        filteredCommits.length === 0 &&
        workspace.commits.sinceLatestPrelease.length > 0
      ) {
        // all commits on the prerelease branch are already released on the stable branch
        // we should patch bump to create a new prerelease version to bring the
        // prerelease branch up to date with the stable branch
        bumpLevel = 'patch';
      } else {
        bumpLevel = calculateSemverIncLevel(filteredCommits);
      }
    }
    return {
      ...workspace,
      bumpLevel,
    };
  });
}
