import {describe, expect, it} from 'vitest';
import {
  subjectRegex,
  breakingChangeFooterRegex,
  calculateSemverIncLevel,
  addBumpLevels,
} from './conventionalCommit.js';
import type {ConventionalCommit, Commit} from '../types.js';

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

describe('addBumpLevels', () => {
  const createWorkspace = ({
    name,
    conventionalCommitsSinceStable = [],
    conventionalCommitsSincePrerelease = [],
    lockfileCommitsSinceStable = [],
    lockfileCommitsSincePrerelease = [],
  }: {
    name: string;
    conventionalCommitsSinceStable?: ConventionalCommit[];
    conventionalCommitsSincePrerelease?: ConventionalCommit[];
    lockfileCommitsSinceStable?: Commit[];
    lockfileCommitsSincePrerelease?: Commit[];
  }) => ({
    name,
    dir: `/packages/${name}`,
    pkgJson: {name},
    latestVersion: {
      stable: undefined,
      prerelease: undefined,
      overall: undefined,
    },
    commits: {
      sinceLatestStable: {
        conventionalTouchingWorkspace: conventionalCommitsSinceStable,
        touchingLockfile: lockfileCommitsSinceStable,
      },
      sinceLatestPrerelease: {
        conventionalTouchingWorkspace: conventionalCommitsSincePrerelease,
        touchingLockfile: lockfileCommitsSincePrerelease,
      },
    },
    workspaceDeps: [],
    workspaceDependencies: [],
  });

  describe('on stable branch', () => {
    describe('with bumpOnLockfileChange enabled', () => {
      it('should bump patch when only lockfile changed', () => {
        const workspaces = [
          createWorkspace({
            name: 'pkg-a',
            lockfileCommitsSinceStable: [
              {abbrevHash: 'abc123', subject: 'chore: update deps'},
            ],
          }),
        ];

        const result = addBumpLevels({
          workspaces,
          onStableBranch: true,
          bumpOnLockfileChange: true,
        });

        expect(result[0]?.bumpLevel).toBe('patch');
      });

      it('should use conventional commit level when both lockfile and conventional commits exist', () => {
        const workspaces = [
          createWorkspace({
            name: 'pkg-a',
            conventionalCommitsSinceStable: [
              {
                abbrevHash: 'abc123',
                subject: {
                  type: 'feat',
                  breaking: false,
                  description: 'add feature',
                },
              },
            ],
            lockfileCommitsSinceStable: [
              {abbrevHash: 'def456', subject: 'chore: update deps'},
            ],
          }),
        ];

        const result = addBumpLevels({
          workspaces,
          onStableBranch: true,
          bumpOnLockfileChange: true,
        });

        expect(result[0]?.bumpLevel).toBe('minor');
      });

      it('should not bump when no changes', () => {
        const workspaces = [createWorkspace({name: 'pkg-a'})];

        const result = addBumpLevels({
          workspaces,
          onStableBranch: true,
          bumpOnLockfileChange: true,
        });

        expect(result[0]?.bumpLevel).toBeUndefined();
      });

      it('should handle multiple workspaces independently', () => {
        const workspaces = [
          createWorkspace({
            name: 'pkg-a',
            conventionalCommitsSinceStable: [
              {
                abbrevHash: 'abc123',
                subject: {
                  type: 'fix',
                  breaking: false,
                  description: 'fix bug',
                },
              },
            ],
          }),
          createWorkspace({
            name: 'pkg-b',
            lockfileCommitsSinceStable: [
              {abbrevHash: 'def456', subject: 'chore: update deps'},
            ],
          }),
          createWorkspace({name: 'pkg-c'}),
        ];

        const result = addBumpLevels({
          workspaces,
          onStableBranch: true,
          bumpOnLockfileChange: true,
        });

        expect(result[0]?.bumpLevel).toBe('patch'); // pkg-a: has fix
        expect(result[1]?.bumpLevel).toBe('patch'); // pkg-b: lockfile only
        expect(result[2]?.bumpLevel).toBeUndefined(); // pkg-c: no changes
      });
    });

    describe('with bumpOnLockfileChange disabled', () => {
      it('should not bump when only lockfile changed', () => {
        const workspaces = [
          createWorkspace({
            name: 'pkg-a',
            lockfileCommitsSinceStable: [
              {abbrevHash: 'abc123', subject: 'chore: update deps'},
            ],
          }),
        ];

        const result = addBumpLevels({
          workspaces,
          onStableBranch: true,
          bumpOnLockfileChange: false,
        });

        expect(result[0]?.bumpLevel).toBeUndefined();
      });

      it('should bump based on conventional commits only', () => {
        const workspaces = [
          createWorkspace({
            name: 'pkg-a',
            conventionalCommitsSinceStable: [
              {
                abbrevHash: 'abc123',
                subject: {
                  type: 'feat',
                  breaking: false,
                  description: 'add feature',
                },
              },
            ],
            lockfileCommitsSinceStable: [
              {abbrevHash: 'def456', subject: 'chore: update deps'},
            ],
          }),
        ];

        const result = addBumpLevels({
          workspaces,
          onStableBranch: true,
          bumpOnLockfileChange: false,
        });

        expect(result[0]?.bumpLevel).toBe('minor');
      });

      it('should not bump when no conventional commits', () => {
        const workspaces = [
          createWorkspace({
            name: 'pkg-a',
            lockfileCommitsSinceStable: [
              {abbrevHash: 'abc123', subject: 'chore: update deps'},
              {abbrevHash: 'def456', subject: 'docs: update readme'},
            ],
          }),
        ];

        const result = addBumpLevels({
          workspaces,
          onStableBranch: true,
          bumpOnLockfileChange: false,
        });

        expect(result[0]?.bumpLevel).toBeUndefined();
      });
    });
  });

  describe('on prerelease branch', () => {
    describe('with bumpOnLockfileChange enabled', () => {
      it('should not bump when no changes', () => {
        const workspaces = [createWorkspace({name: 'pkg-a'})];

        const result = addBumpLevels({
          workspaces,
          onStableBranch: false,
          bumpOnLockfileChange: true,
        });

        expect(result[0]?.bumpLevel).toBeUndefined();
      });
      it('should bump patch when only lockfile changed', () => {
        const workspaces = [
          createWorkspace({
            name: 'pkg-a',
            lockfileCommitsSincePrerelease: [
              {abbrevHash: 'abc123', subject: 'chore: update deps'},
            ],
          }),
        ];

        const result = addBumpLevels({
          workspaces,
          onStableBranch: false,
          bumpOnLockfileChange: true,
        });

        expect(result[0]?.bumpLevel).toBe('patch');
      });

      it('should bump patch when lockfile changed and new commits are only on stable', () => {
        const workspaces = [
          createWorkspace({
            name: 'pkg-a',
            conventionalCommitsSinceStable: [
              {
                abbrevHash: 'abc123',
                subject: {
                  type: 'feat',
                  breaking: false,
                  description: 'add feature',
                },
              },
            ],
            lockfileCommitsSincePrerelease: [
              {abbrevHash: 'def456', subject: 'chore: update deps'},
            ],
          }),
        ];

        const result = addBumpLevels({
          workspaces,
          onStableBranch: false,
          bumpOnLockfileChange: true,
        });

        expect(result[0]?.bumpLevel).toBe('patch');
      });

      it('should use conventional commit level when both exist', () => {
        const workspaces = [
          createWorkspace({
            name: 'pkg-a',
            conventionalCommitsSincePrerelease: [
              {
                abbrevHash: 'def456',
                subject: {
                  type: 'feat',
                  breaking: false,
                  description: 'new feature',
                },
              },
            ],
            lockfileCommitsSincePrerelease: [
              {abbrevHash: 'ghi789', subject: 'chore: update deps'},
            ],
          }),
        ];

        const result = addBumpLevels({
          workspaces,
          onStableBranch: false,
          bumpOnLockfileChange: true,
        });

        expect(result[0]?.bumpLevel).toBe('patch');
      });

      it('should patch bump to sync when all prerelease commits are on stable', () => {
        const workspaces = [
          createWorkspace({
            name: 'pkg-a',
            conventionalCommitsSincePrerelease: [
              {
                abbrevHash: 'abc123',
                subject: {
                  type: 'feat',
                  breaking: false,
                  description: 'feature',
                },
              },
            ],
          }),
        ];

        const result = addBumpLevels({
          workspaces,
          onStableBranch: false,
          bumpOnLockfileChange: true,
        });

        // should patch bump even though the commit is a feature
        // because it's already released on stable and we are just bumping to sync the branches
        expect(result[0]?.bumpLevel).toBe('patch');
      });
    });

    describe('with bumpOnLockfileChange disabled', () => {
      it('should not bump when only lockfile changed', () => {
        const workspaces = [
          createWorkspace({
            name: 'pkg-a',
            lockfileCommitsSincePrerelease: [
              {abbrevHash: 'abc123', subject: 'chore: update deps'},
            ],
          }),
        ];

        const result = addBumpLevels({
          workspaces,
          onStableBranch: false,
          bumpOnLockfileChange: false,
        });

        expect(result[0]?.bumpLevel).toBeUndefined();
      });

      it('should bump based on conventional commits only', () => {
        const workspaces = [
          createWorkspace({
            name: 'pkg-a',
            conventionalCommitsSinceStable: [
              {
                abbrevHash: 'def456',
                subject: {
                  type: 'feat',
                  breaking: true,
                  description: 'breaking change',
                },
              },
            ],
            conventionalCommitsSincePrerelease: [
              {
                abbrevHash: 'def456',
                subject: {
                  type: 'feat',
                  breaking: true,
                  description: 'breaking change',
                },
              },
            ],
            lockfileCommitsSincePrerelease: [
              {abbrevHash: 'ghi789', subject: 'chore: update deps'},
            ],
          }),
        ];

        const result = addBumpLevels({
          workspaces,
          onStableBranch: false,
          bumpOnLockfileChange: false,
        });

        expect(result[0]?.bumpLevel).toBe('major');
      });
    });
  });
});
