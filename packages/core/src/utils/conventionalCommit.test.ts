import {describe, expect, it} from 'vitest';
import {
  subjectRegex,
  breakingChangeFooterRegex,
  calculateSemverIncLevel,
} from './conventionalCommit.js';
import type {ConventionalCommit} from '../types.js';

describe('subjectRegex', () => {
  it('matches basic feat commit', () => {
    const subject = 'feat: add new feature';
    const match = subjectRegex.exec(subject);
    expect(match?.groups).toEqual({
      type: 'feat',
      scope: undefined,
      breaking: undefined,
      description: 'add new feature',
    });
  });

  it('matches basic fix commit', () => {
    const subject = 'fix: resolve bug';
    const match = subjectRegex.exec(subject);
    expect(match?.groups).toEqual({
      type: 'fix',
      scope: undefined,
      breaking: undefined,
      description: 'resolve bug',
    });
  });

  it('matches commit with scope', () => {
    const subject = 'feat(api): add new endpoint';
    const match = subjectRegex.exec(subject);
    expect(match?.groups).toEqual({
      type: 'feat',
      scope: 'api',
      breaking: undefined,
      description: 'add new endpoint',
    });
  });

  it('matches breaking change with !', () => {
    const subject = 'feat!: breaking change';
    const match = subjectRegex.exec(subject);
    expect(match?.groups).toEqual({
      type: 'feat',
      scope: undefined,
      breaking: '!',
      description: 'breaking change',
    });
  });

  it('matches breaking change with scope', () => {
    const subject = 'fix(core)!: breaking fix';
    const match = subjectRegex.exec(subject);
    expect(match?.groups).toEqual({
      type: 'fix',
      scope: 'core',
      breaking: '!',
      description: 'breaking fix',
    });
  });

  it('does not match invalid type', () => {
    const subject = 'invalid: not a valid type';
    const match = subjectRegex.exec(subject);
    expect(match).toEqual(null);
  });
});

describe('breakingChangeFooterRegex', () => {
  it('matches basic breaking change footer', () => {
    const body = '\n\nBREAKING CHANGE: this is a breaking change';
    const match = breakingChangeFooterRegex.exec(body);
    expect(match?.groups?.description).toMatch('this is a breaking change');
  });

  it('matches breaking change with hyphen', () => {
    const body = '\n\nBREAKING-CHANGE: another breaking change';
    const match = breakingChangeFooterRegex.exec(body);
    expect(match?.groups?.description).toMatch('another breaking change');
  });

  it('matches breaking change with body before footer', () => {
    const body = `Did this for a reason\n\nBREAKING CHANGE: this is a breaking change`;
    const match = breakingChangeFooterRegex.exec(body);
    expect(match?.groups?.description).toMatch('this is a breaking change');
  });

  it('matches without double newline prefix', () => {
    const body = 'BREAKING CHANGE: with no newline prefix';
    const match = breakingChangeFooterRegex.exec(body);
    expect(match?.groups?.description).toStrictEqual('with no newline prefix');
  });

  it('matches multi line breaking change description', () => {
    const body = `BREAKING CHANGE: this is a breaking change\n\nwith multiple lines`;
    const match = breakingChangeFooterRegex.exec(body);
    expect(match?.groups?.description).toMatch(
      'this is a breaking change\n\nwith multiple lines',
    );
  });

  it('matches multi line breaking change that is followed by another footer', () => {
    const body = `BREAKING CHANGE: this is a breaking change\n\nwith multiple lines\n\nAnother-footer: this is another footer`;
    const match = breakingChangeFooterRegex.exec(body);
    expect(match?.groups?.description).toMatch(
      'this is a breaking change\n\nwith multiple lines',
    );
  });

  it('does not match without proper prefix', () => {
    const body = '\n\nBREAK CHANGE: invalid prefix';
    const match = breakingChangeFooterRegex.exec(body);
    expect(match).toStrictEqual(null);
  });
});

describe('calculateSemverIncLevel', () => {
  it('returns major for breaking change with !', () => {
    const commits: ConventionalCommit[] = [
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'feat',
          breaking: true,
          description: 'breaking change',
        },
      },
    ];
    expect(calculateSemverIncLevel(commits)).toBe('major');
  });

  it('returns major for breaking change in footer', () => {
    const commits: ConventionalCommit[] = [
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'feat',
          breaking: false,
          description: 'feature with breaking change',
        },
        body: {
          breakingChangeDescription: 'this breaks the API',
        },
      },
    ];
    expect(calculateSemverIncLevel(commits)).toBe('major');
  });

  it('returns minor for feature', () => {
    const commits: ConventionalCommit[] = [
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'feat',
          breaking: false,
          description: 'new feature',
        },
      },
    ];
    expect(calculateSemverIncLevel(commits)).toBe('minor');
  });

  it('returns patch for fix', () => {
    const commits: ConventionalCommit[] = [
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'fix',
          breaking: false,
          description: 'bug fix',
        },
      },
    ];
    expect(calculateSemverIncLevel(commits)).toBe('patch');
  });

  it('returns undefined for no relevant commits', () => {
    expect(calculateSemverIncLevel([])).toBeUndefined();
  });

  it('returns major when mixed commits include breaking change', () => {
    const commits: ConventionalCommit[] = [
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'fix',
          breaking: false,
          description: 'bug fix',
        },
      },
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'feat',
          breaking: true,
          description: 'breaking change',
        },
      },
    ];
    expect(calculateSemverIncLevel(commits)).toBe('major');
  });

  it('returns minor when mixed commits include feature without breaking change', () => {
    const commits: ConventionalCommit[] = [
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'fix',
          breaking: false,
          description: 'bug fix',
        },
      },
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'feat',
          breaking: false,
          description: 'new feature',
        },
      },
    ];
    expect(calculateSemverIncLevel(commits)).toBe('minor');
  });

  it('returns major when commits include both breaking change and features', () => {
    const commits: ConventionalCommit[] = [
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'feat',
          breaking: true,
          description: 'breaking feature change',
        },
      },
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'feat',
          breaking: false,
          description: 'new feature',
        },
      },
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'fix',
          breaking: false,
          description: 'bug fix',
        },
      },
    ];
    expect(calculateSemverIncLevel(commits)).toBe('major');
  });

  it('returns major when one commit has breaking change in footer among other commits', () => {
    const commits: ConventionalCommit[] = [
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'fix',
          breaking: false,
          description: 'bug fix with breaking change',
        },
        body: {
          breakingChangeDescription: 'this completely changes the API',
        },
      },
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'feat',
          breaking: false,
          description: 'new feature',
        },
      },
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'fix',
          breaking: false,
          description: 'another bug fix',
        },
      },
    ];
    expect(calculateSemverIncLevel(commits)).toBe('major');
  });

  it('returns minor when multiple features and fixes exist without breaking changes', () => {
    const commits: ConventionalCommit[] = [
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'feat',
          breaking: false,
          description: 'first new feature',
        },
      },
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'fix',
          breaking: false,
          description: 'first bug fix',
        },
      },
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'feat',
          breaking: false,
          description: 'second new feature',
        },
      },
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'fix',
          breaking: false,
          description: 'another bug fix',
        },
      },
    ];
    expect(calculateSemverIncLevel(commits)).toBe('minor');
  });

  it('returns patch when multiple fixes exist', () => {
    const commits: ConventionalCommit[] = [
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'fix',
          breaking: false,
          description: 'first bug fix',
        },
      },
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'fix',
          breaking: false,
          description: 'second bug fix',
        },
      },
      {
        abbrevHash: 'abc123',
        subject: {
          type: 'fix',
          breaking: false,
          description: 'third bug fix',
        },
      },
    ];
    expect(calculateSemverIncLevel(commits)).toBe('patch');
  });
});
