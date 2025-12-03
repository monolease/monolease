import type {ConventionalCommit, Commit} from '@monolease/core';

interface GenerateChangelogOptions {
  conventionalCommits: ConventionalCommit[];
  commitsTouchingLockFile: Commit[];
  nextVersion: string;
  bumpedWorkspaceDependencies: {
    name: string;
    version: string;
  }[];
}

function generateChangelog({
  bumpedWorkspaceDependencies,
  conventionalCommits,
  commitsTouchingLockFile,
  nextVersion,
}: GenerateChangelogOptions) {
  let fixes = '';
  let features = '';
  let breakingChanges = '';
  let dependencyBumps = '';
  let lockFileChanges = '';

  for (const conventionalCommit of conventionalCommits) {
    const scope =
      conventionalCommit.subject.scope ?
        `**${conventionalCommit.subject.scope}:** `
      : '';
    const change = `- ${scope}${conventionalCommit.subject.description} (${conventionalCommit.abbrevHash})\n`;
    let breaking: string | undefined;
    if (
      conventionalCommit.subject.breaking ||
      conventionalCommit.body?.breakingChangeDescription
    ) {
      breaking = `- ${scope}${conventionalCommit.body?.breakingChangeDescription ?? conventionalCommit.subject.description} (${conventionalCommit.abbrevHash})\n`;
    }

    if (conventionalCommit.subject.type === 'feat') {
      features += change;
    }
    if (conventionalCommit.subject.type === 'fix') {
      fixes += change;
    }
    if (breaking) {
      breakingChanges += breaking;
    }
  }

  for (const dep of bumpedWorkspaceDependencies) {
    dependencyBumps += `- **${dep.name}** bumped to ${dep.version}\n`;
  }

  for (const lockFileCommit of commitsTouchingLockFile) {
    lockFileChanges += `- ${lockFileCommit.subject} (${lockFileCommit.abbrevHash})\n`;
  }

  let changelog = `# ${nextVersion} (${new Date().toISOString().slice(0, 10)})`;

  if (features) {
    changelog += `\n## Features\n${features}`;
  }
  if (fixes) {
    changelog += `\n## Fixes\n${fixes}`;
  }
  if (dependencyBumps) {
    changelog += `\n## Workspace Dependency Bumps\n${dependencyBumps}`;
  }
  if (breakingChanges) {
    changelog += `\n## Breaking Changes\n${breakingChanges}`;
  }
  if (lockFileChanges) {
    changelog += `\n## Lockfile Changes\n${lockFileChanges}`;
  }

  return changelog;
}

interface Workspace {
  name: string;
  nextVersion: string;
  conventionalCommits: ConventionalCommit[];
  commitsTouchingLockFile: Commit[];
  bumpedWorkspaceDependencies: string[];
}

export default function generateChangelogs(workspaces: Workspace[]) {
  return workspaces.map(workspace => {
    const mappedWorkspaceDependencies: GenerateChangelogOptions['bumpedWorkspaceDependencies'] =
      [];

    for (const depName of workspace.bumpedWorkspaceDependencies) {
      const dep = workspaces.find(w => w.name === depName);
      if (!dep) {
        throw new Error(
          `Workspace dependency ${depName} not found in run result`,
        );
      }
      if (!dep.nextVersion) {
        throw new Error(
          `Workspace dependency ${depName} does not have a next version`,
        );
      }
      mappedWorkspaceDependencies.push({
        name: dep.name,
        version: dep.nextVersion,
      });
    }

    const changelog = generateChangelog({
      bumpedWorkspaceDependencies: mappedWorkspaceDependencies,
      conventionalCommits: workspace.conventionalCommits,
      // exclude lockfile commits that are already included as conventional commits
      // so that they don't appear twice in the changelog
      commitsTouchingLockFile: workspace.commitsTouchingLockFile.filter(
        lockFileCommit =>
          !workspace.conventionalCommits.some(
            cc => cc.abbrevHash === lockFileCommit.abbrevHash,
          ),
      ),
      nextVersion: workspace.nextVersion,
    });

    return {
      name: workspace.name,
      changelog,
    };
  });
}
