# Docker image releases

## v6 preview

For `6.0.0-preview`, merge the migration and deployment changes first, then
create the `6.0.0-preview` tag from the tested commit. Dispatch the build from
that tag with `version=6.0.0-preview`. The four published images are UI, API,
control-plane, and ELS. Review their recorded digests and run a fresh install
plus an upgrade using the deployment files from the same tag. Publish a GitHub
Pre-release with the supported upgrade path and database migration instructions.
Do not run **Promote Docker Images to Latest** for a preview release; the
default README installation remains pinned to the latest stable version.

## Prepare and build

1. Merge the release preparation PR, including the matching `.env` version (if used),
   README installation tag, and any deployment or database changes.
2. Create the numeric Git tag, e.g. `6.0.0`, at that commit. Do not move published tags.
3. Dispatch **Publish Docker Images** from that tag:

   ```sh
   gh workflow run publish-docker-images.yml --ref 6.0.0 -f version=6.0.0
   ```

   The workflow checks the source commit and `.env` (when present), rejects existing version
   images, and builds UI, API, control-plane, and ELS for amd64 and arm64. It never updates
   `latest`. Authentication/network errors are failures, not evidence that a tag
   is available. Avoid other publishers writing the same tags concurrently;
   workflow checks are not a registry-level immutable-tag policy.
4. Keep the successful run ID and its four `release-image-*` artifacts. Each
   records the version, source commit, run ID, and multi-platform image digest.
5. Validate a fresh installation and an upgrade with retained data, using these
   exact images and the release tag's deployment files. Check tag digests against
   the artifacts. Build success alone does not establish installation/upgrade success.

## Promote a stable release

After validation, dispatch **Promote Docker Images to Latest** from the same tag:

```sh
gh workflow run promote-docker-images.yml --ref 6.0.0 \
  -f version=6.0.0 -f build-run-id=123456789
```

This is the maintainer's explicit confirmation that the selected run was tested.
Use the existing `Production` environment's approval controls if configured.
Promotion accepts only stable versions and a successful build run for the same
tag/commit. It downloads that run's records, checks all four current version
digests and both platforms before any write, then copies each recorded digest
to `latest` without building. Promotions are serialized. Each updated digest is
verified, and `promotion.json` records previous digests and per-image results.

After successful promotion, publish the GitHub Release and update main's README
installation tag. Preview releases use only the build workflow and are published
as GitHub Pre-releases; they do not update `latest`.

## Failure recovery and workflow availability

- Multi-image promotion is not atomic. On failure, inspect `promotion.json` from
  the run artifact and the live registry. An unverified image may already have
  changed. Rerun promotion with the same build run ID to complete it, or manually
  restore `latest` from the recorded `previous_latest` digests with
  `docker buildx imagetools create --tag featbit/APP:latest featbit/APP@sha256:...`.
  Preserve the original failure record: a retry captures its own starting state.
- After a partial build, use GitHub's **Re-run failed jobs**, which preserves
  successful matrix jobs. Each retried job also refuses to overwrite its image;
  a job that pushed an image but failed before saving its record cannot simply
  rebuild it. Do not rerun the entire build to overwrite published
  images. If recovery requires changing code or rebuilding an already published
  image, prepare a new release version.
- Build records expire after 90 days (or the repository's shorter retention
  limit). Archive them for long-term audit. This automated promotion requires
  the original run artifacts and fails closed when they are unavailable.
- GitHub requires dispatchable workflows to exist on the default branch. Before
  the first use, register/sync the new workflow on main as well; dispatch using
  `--ref` with the release tag so that tag's workflow and service matrix run.
  This main-branch configuration uses the v6 service matrix, including control-plane
  instead of DA. The version numbers above illustrate the commands; do not apply
  this service matrix to a v5 release.
- The new workflow must be included in the release tag itself. The existing
  `5.4.9` tag does not contain these workflows and cannot use this procedure.

Local checks (no registry writes):

```sh
python -m unittest discover -s .github/scripts -p 'test_*.py'
actionlint .github/workflows/publish-docker-images.yml .github/workflows/promote-docker-images.yml
```
