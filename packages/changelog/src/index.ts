import type {ConventionalCommit} from '@monolease/core';

interface GenerateChangelogOptions {
  commits: ConventionalCommit[];
  nextVersion: string;
  bumpedWorkspaceDependencies: {
    name: string;
    version: string;
  }[];
}

function generateChangelog({
  bumpedWorkspaceDependencies,
  commits,
  nextVersion,
}: GenerateChangelogOptions) {
  let fixes = '';
  let features = '';
  let breakingChanges = '';
  let dependencyBumps = '';

  for (const commit of commits) {
    const scope = commit.subject.scope ? `**${commit.subject.scope}:** ` : '';
    const change = `- ${scope}${commit.subject.description} (${commit.abbrevHash})\n`;
    let breaking: string | undefined;
    if (commit.subject.breaking || commit.body?.breakingChangeDescription) {
      breaking = `- ${scope}${commit.body?.breakingChangeDescription ?? commit.subject.description} (${commit.abbrevHash})\n`;
    }

    if (commit.subject.type === 'feat') {
      features += change;
    }
    if (commit.subject.type === 'fix') {
      fixes += change;
    }
    if (breaking) {
      breakingChanges += breaking;
    }
  }

  for (const dep of bumpedWorkspaceDependencies) {
    dependencyBumps += `- **${dep.name}** bumped to ${dep.version}\n`;
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

  return changelog;
}

interface Workspace {
  name: string;
  nextVersion: string;
  commits: ConventionalCommit[];
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
      commits: workspace.commits,
      nextVersion: workspace.nextVersion,
    });

    return {
      name: workspace.name,
      changelog,
    };
  });
}
