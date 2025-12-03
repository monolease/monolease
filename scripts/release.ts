import release, { type ConfigInput } from "@monolease/core";
import addChangelogs from "@monolease/changelog";
import createGitHubReleases from "@monolease/github";
import updatePkgJsonVersions from "@monolease/pkg-json-version";
import publish from "@monolease/npm-registry";

const { GH_API_TOKEN, GH_REPO_OWNER_AND_NAME } = process.env;

if (!GH_API_TOKEN || !GH_REPO_OWNER_AND_NAME) {
  throw new Error(
    "Environment variables GH_API_TOKEN and GH_REPO_OWNER_AND_NAME must be set."
  );
}

const config: ConfigInput = {
  stable: {
    branch: "release",
  },
  prerelease: {
    branch: "main",
    identifier: "rc",
  },
  bumpOnLockfileChange: true,
};

const { onStableBranch, workspaces } = await release({
  config,
  packageManager: "pnpm",
});

await updatePkgJsonVersions(
  workspaces.map((workspace) => {
    const latestBranchTag =
      workspace.latestVersion[onStableBranch ? "stable" : "prerelease"];

    return {
      dir: workspace.dir,
      version:
        workspace.nextVersion?.raw ?? latestBranchTag?.version.raw ?? "0.0.0",
    };
  })
);

const withNextVersion = workspaces.filter((workspace) => workspace.nextVersion);

const changelogs = addChangelogs(
  withNextVersion.map<Parameters<typeof addChangelogs>[0][number]>(
    (workspace) => ({
      name: workspace.name,
      nextVersion: workspace.nextVersion!.raw,
      bumpedWorkspaceDependencies: workspace.bumpedWorkspaceDependencies,
      conventionalCommits: onStableBranch
        ? workspace.commits.sinceLatestStable.conventionalTouchingWorkspace
        : workspace.commits.sinceLatestPrerelease.conventionalTouchingWorkspace,
      commitsTouchingLockFile: onStableBranch
        ? workspace.commits.sinceLatestStable.touchingLockfile
        : workspace.commits.sinceLatestPrerelease.touchingLockfile,
    })
  )
);

await createGitHubReleases({
  workspaces: withNextVersion.map<
    Parameters<typeof createGitHubReleases>[0]["workspaces"][number]
  >((workspace) => ({
    name: workspace.name,
    // workspaces without nextVersion has already been filtered out
    nextVersion: workspace.nextVersion!.raw,
    changelog: changelogs.find((changelog) => changelog.name === workspace.name)
      ?.changelog!,
    prerelease: !onStableBranch,
    // workspaces with nextVersion have a createdTag
    createdTag: workspace.createdTag!,
  })),
  apiOptions: {
    apiToken: GH_API_TOKEN,
    repoOwnerAndName: GH_REPO_OWNER_AND_NAME,
  },
});

await publish(
  withNextVersion.map((workspace) => ({
    workspaceName: workspace.name,
    access: "public",
    tag: onStableBranch ? "latest" : "rc",
    packageManager: "pnpm",
  }))
);
