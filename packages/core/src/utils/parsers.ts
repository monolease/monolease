import {isObject, isStringArray, isStringRecord} from '@monolease/util';
import {gitAbbrevHashRegex} from '../constants.js';
import type {
  Commit,
  Config,
  ConfigInput,
  ConventionalCommitSubject,
  PkgJson,
} from '../types.js';
import {isAbbrevHash} from './asserters.js';

export function parseConfig(configInput: ConfigInput): Config {
  return {
    ...configInput,
    pushTags: configInput.pushTags ?? true,
    dryRun: configInput.dryRun ?? false,
    bumpOnLockfileChange: configInput.bumpOnLockfileChange ?? false,
  };
}

export function parsePkgJson(pkgJsonInput: unknown): PkgJson {
  if (!isObject(pkgJsonInput)) {
    throw new Error('Expected pkgJson to be an object');
  }

  const {name, workspaces, dependencies, devDependencies, peerDependencies} =
    pkgJsonInput;

  if (typeof name !== 'string') {
    throw new Error('Expected pkgJson.name to be a string');
  }

  if (typeof workspaces !== 'undefined' && !isStringArray(workspaces)) {
    throw new Error('Expected pkgJson.workspaces to be a string array');
  }

  if (typeof dependencies !== 'undefined' && !isStringRecord(dependencies)) {
    throw new Error(
      'Expected pkgJson.dependencies to be a Record<string, string>',
    );
  }

  if (
    typeof devDependencies !== 'undefined' &&
    !isStringRecord(devDependencies)
  ) {
    throw new Error(
      'Expected pkgJson.devDependencies to be a Record<string, string>',
    );
  }

  if (
    typeof peerDependencies !== 'undefined' &&
    !isStringRecord(peerDependencies)
  ) {
    throw new Error(
      'Expected pkgJson.peerDependencies to be a Record<string, string>',
    );
  }

  return {
    name,
    workspaces,
    dependencies,
    devDependencies,
    peerDependencies,
  };
}

export function parseCommit(commitInput: unknown): Commit {
  if (!isObject(commitInput)) {
    throw new Error('Expected commit to be an object');
  }

  const {abbrevHash, subject, body} = commitInput;

  if (!isAbbrevHash(abbrevHash)) {
    throw new Error(
      `Expected commit.abbrevHash to be a string matching ${gitAbbrevHashRegex.source}`,
    );
  }

  if (typeof subject !== 'string') {
    throw new Error('Expected commit.subject to be a string');
  }

  if (typeof body !== 'undefined' && typeof body !== 'string') {
    throw new Error('Expected commit.body to be a string');
  }

  return {
    abbrevHash,
    subject,
    body,
  };
}

export function parseConventionalCommitSubject(
  subjectInput: unknown,
): ConventionalCommitSubject {
  if (!isObject(subjectInput)) {
    throw new Error('Expected subject to be an object');
  }

  const {type, scope, breaking, description} = subjectInput;

  if (type !== 'feat' && type !== 'fix') {
    throw new Error('Expected subject.type to be "feat" or "fix"');
  }

  if (typeof scope !== 'undefined' && typeof scope !== 'string') {
    throw new Error('Expected subject.scope to be a string');
  }

  if (typeof breaking !== 'boolean') {
    throw new Error('Expected subject.breaking to be a boolean');
  }

  if (typeof description !== 'string') {
    throw new Error('Expected subject.description to be a string');
  }

  return {
    type,
    scope,
    breaking,
    description,
  };
}
