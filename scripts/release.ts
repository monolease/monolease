import release, { type ConfigInput } from "@monolease/core";
import addChangelogs from "@monolease/changelog";
import createGitHubReleases from "@monolease/github";
import updatePkgJsonVersions from "@monolease/pkg-json-version";

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
};

const releaseResult = await release({ config });

const withNextVersion = releaseResult.workspaces.filter(
  (workspace) => workspace.nextVersion
);

const changelogs = addChangelogs(
  withNextVersion.map<Parameters<typeof addChangelogs>[0][number]>(
    (workspace) => ({
      name: workspace.name,
      nextVersion: workspace.nextVersion!.raw,
      bumpedWorkspaceDependencies: workspace.bumpedWorkspaceDependencies,
      commits: releaseResult.onStableBranch
        ? workspace.commits.sinceLatestStable
        : workspace.commits.sinceLatestPrelease,
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
    prerelease: !releaseResult.onStableBranch,
    // workspaces with nextVersion have a createdTag
    createdTag: workspace.createdTag!,
  })),
  apiOptions: {
    apiToken: GH_API_TOKEN,
    repoOwnerAndName: GH_REPO_OWNER_AND_NAME,
  },
});

await updatePkgJsonVersions(
  withNextVersion.map((workspace) => ({
    dir: workspace.dir,
    nextVersion: workspace.nextVersion!.raw,
  }))
);

// trigger pr
