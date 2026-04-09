import type {SemVer} from 'semver';

export interface ConfigInput {
  stable: {
    branch: string;
  };
  prerelease?:
    | {
        branch: string;
        identifier: string;
      }
    | undefined;
  pushTags?: boolean | undefined;
  dryRun?: boolean | undefined;
  bumpOnLockfileChange?: boolean | undefined;
  /**
   * An array of workspace package names to completely exclude from the release
   * pipeline. Ignored workspaces will not receive version bumps, git tags,
   * GitHub releases, or npm publishes.
   *
   * Use this for workspaces that should never be released, such as example apps
   * or internal tooling.
   *
   * If you only want to skip npm publishing but still create tags and GitHub
   * releases, set `"private": true` in the workspace's package.json instead.
   */
  ignoreWorkspaces?: string[] | undefined;
}

export interface Config
  extends Omit<
    ConfigInput,
    'pushTags' | 'dryRun' | 'bumpOnLockfileChange' | 'ignoreWorkspaces'
  > {
  dryRun: boolean;
  pushTags: boolean;
  bumpOnLockfileChange: boolean;
  ignoreWorkspaces: string[];
}

export interface PkgJson {
  name: string;
  workspaces?: string[] | undefined;
  dependencies?: Record<string, string> | undefined;
  devDependencies?: Record<string, string> | undefined;
  peerDependencies?: Record<string, string> | undefined;
}

export interface Commit {
  abbrevHash: string;
  subject: string;
  body?: string | undefined;
}

export interface ConventionalCommitSubject {
  type: 'feat' | 'fix';
  breaking: boolean;
  description: string;
  scope?: string | undefined;
}

export interface ConventionalCommit {
  abbrevHash: string;
  subject: ConventionalCommitSubject;
  body?:
    | {
        breakingChangeDescription?: string | undefined;
      }
    | undefined;
}

export interface Workspace {
  name: string;
  dir: string;
  pkgJson: PkgJson;
}

export interface ReleaseTag {
  raw: string;
  version: SemVer;
  packageName: string;
}

export type PackageManager = 'npm' | 'yarn' | 'pnpm';
