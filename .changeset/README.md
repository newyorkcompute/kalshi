# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets).

## Adding a changeset

When you make a change that should be released, run:

```bash
npx changeset
```

This will prompt you to:
1. Select which packages have changed
2. Choose the semver bump type (major/minor/patch)
3. Write a summary of the changes

The changeset file will be committed with your PR.

## Releasing

On merge to `main`, the Changesets GitHub Action will:
1. Create a "Version Packages" PR with version bumps and changelog updates
2. When that PR is merged, it publishes to npm automatically

