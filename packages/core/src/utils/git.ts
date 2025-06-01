import {isObject} from './asserters.js';
import type {Commit} from '../types.js';
import {parseCommit} from './parsers.js';
import {spawn} from './spawn.js';

export function git(args: string[], cwd?: string) {
  return spawn('git', args, {cwd});
}

export async function getRootDir(cwd?: string) {
  return (await git(['rev-parse', '--show-toplevel'], cwd)).stdout;
}

export async function getCurrentBranch(cwd?: string) {
  return (await git(['branch', '--show-current'], cwd)).stdout;
}

export async function createTag(
  {name, message}: {name: string; message: string},
  cwd?: string,
) {
  return git(['tag', '-a', name, '-m', message], cwd);
}

export async function pushTag(name: string, cwd?: string) {
  return git(['push', 'origin', name], cwd);
}

interface ListTagsOptions {
  /**
   * List only tags that are reachable from the given branch
   */
  branch?: string;

  /**
   * List only tags matching the given pattern
   */
  pattern?: string;

  /**
   * Sort tags by refname, creatordate or -creatordate
   */
  sort?: 'refname' | 'creatordate' | '-creatordate';
}

export async function listTags(options?: ListTagsOptions, cwd?: string) {
  const {sort = 'refname', branch, pattern} = options ?? {};
  const args: string[] = ['tag', '--list', '--sort', sort];

  if (branch) {
    args.push('--merged', branch);
  }

  if (pattern) {
    args.push(pattern);
  }

  const {stdout} = await git(args, cwd);

  if (!stdout) {
    return [];
  }
  // Split the output by newlines (handling both \n and \r\n)
  return stdout.split(/\r?\n/);
}

interface ListCommitsOptions {
  /**
   * Examples:
   * - `main` only commits on the main branch
   * - `tagName...main` only commits since the tag and on the main branch
   */
  revisionRange?: string | undefined;
  /**
   * Only commits that touch any of these paths will be included.
   */
  paths?: string[] | undefined;
}

// The seperator is used to split the commit abbreviated hash, subject and body
// when parsing the output of `git log`. Using uuid to avoid string that might
// appear in the commit message. Generated using crypto.randomUUID()
const seperator = '050a6083-931d-4ef4-ac29-f57bb30bddab';
const end = 'd93b92df-991d-4768-ab42-2a8d09f5f006';

/**
 * Ignores commits without a subject
 */
export async function listCommits(
  {paths, revisionRange}: ListCommitsOptions = {},
  cwd?: string,
) {
  // `%-C()` is used as a hack to remove any trailing newlines after the commit body
  // either added in the commit message or by the git log command itself.
  // see https://stackoverflow.com/a/58020936
  const args = [
    'log',
    `--format=${seperator}%h${seperator}%s${seperator}%b%-C()${end}`,
  ];
  if (revisionRange) {
    args.push(revisionRange);
  }
  if (paths) {
    args.push('--', ...paths);
  }
  // note that this currently fails if the repo is empty.
  // if it is, no stdout,err or anything is returned.
  // to actually get the error, we need to add a pipe to the command
  // to make git output the error.
  const commits: Commit[] = [];
  const {stdout} = await git(args, cwd).catch((error: unknown) => {
    if (
      isObject(error) &&
      typeof error.stderr === 'string' &&
      /your current branch.*does not have any commits yet/.test(error.stderr)
    ) {
      // return an empty string instead of throwing an error
      // if the error is that there are no commits yet
      return {
        stdout: '',
      };
    }
    console.log(error);

    throw error;
  });

  const parts = stdout.split(end);
  const popped = parts.pop();
  if (popped !== '') {
    throw new Error(`Expected popped to be an empty string`);
  }

  for (const part of parts) {
    // first part is either an empty string or a newline
    const [, abbrevHash, subject, body] = part.split(seperator);
    try {
      const parsed = parseCommit({
        abbrevHash,
        subject,
        // body will be an empty string if there is no body since we are splitting
        // on the seperator
        body: body === '' ? undefined : body,
      });
      commits.push(parsed);
    } catch {
      // ignoring commits that aren't valid conventional commits
    }
  }

  return commits;
}
