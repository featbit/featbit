import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

import release_images as release


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        original = os.getcwd()
        os.chdir(self.directory.name)
        self.addCleanup(os.chdir, original)
        env = patch.dict(os.environ, VERSION="5.4.10", GITHUB_REF="refs/tags/5.4.10",
                         GITHUB_SHA="abc", BUILD_RUN_ID="123")
        env.start()
        self.addCleanup(env.stop)
        Path(".env").write_text("FEATBIT_VERSION=5.4.10\n")
        self.digest = "sha256:" + "a" * 64
        for app in release.APPS:
            release.save(f"release-images/{app}.json", {
                "app": app, "version": "5.4.10", "commit": "abc",
                "run_id": "123", "digest": self.digest})

    @patch.object(release.subprocess, "check_output", return_value="abc\n")
    def test_validate_rejects_wrong_ref_version_and_preview_promotion(self, _):
        release.validate()
        Path(".env").unlink()
        release.validate()
        Path(".env").write_text("FEATBIT_VERSION=5.4.10\n")
        with patch.dict(os.environ, GITHUB_REF="refs/heads/main"):
            with self.assertRaises(ValueError):
                release.validate()
        Path(".env").write_text("FEATBIT_VERSION=5.4.9\n")
        with self.assertRaises(ValueError):
            release.validate()
        with patch.dict(os.environ, VERSION="6.0.0-preview"):
            with self.assertRaises(ValueError):
                release.validate(stable=True)

    @patch.object(release, "json_request", return_value={"token": "test"})
    def test_only_registry_404_means_missing(self, _):
        for code in (401, 403, 429, 500, 404):
            error = HTTPError("url", code, "failure", {}, None)
            self.addCleanup(error.close)
            with self.subTest(code=code), patch.object(release, "urlopen", side_effect=
                    error):
                if code == 404:
                    self.assertIsNone(release.manifest(release.APPS[0], "5.4.10", True))
                else:
                    with self.assertRaises(HTTPError):
                        release.manifest(release.APPS[0], "5.4.10", True)

    @patch.object(release, "validate", return_value=("5.4.10", "abc"))
    @patch.object(release, "manifest", return_value=("existing", {}))
    def test_preflight_refuses_existing_version(self, *_):
        with self.assertRaises(ValueError):
            release.preflight()
        with patch.dict(os.environ, APP=release.APPS[0]):
            with self.assertRaises(ValueError):
                release.preflight_app()

    @patch.object(release, "validate", return_value=("5.4.10", "abc"))
    @patch.object(release, "json_request")
    def test_promotion_rejects_wrong_or_unsuccessful_build(self, request, _):
        valid = {"path": ".github/workflows/publish-docker-images.yml",
                 "event": "workflow_dispatch", "head_sha": "abc",
                 "head_branch": "5.4.10", "conclusion": "success"}
        with patch.dict(os.environ, GITHUB_REPOSITORY="featbit/featbit", GH_TOKEN="test"):
            request.return_value = valid
            release.validate_promotion()
            for key, value in (("head_sha", "other"), ("head_branch", "main"),
                               ("conclusion", "failure"), ("event", "pull_request"),
                               ("path", ".github/workflows/other.yml")):
                request.return_value = {**valid, key: value}
                with self.subTest(key=key), self.assertRaises(ValueError):
                    release.validate_promotion()

    @patch.object(release, "validate", return_value=("5.4.10", "abc"))
    @patch.object(release.subprocess, "run")
    def test_missing_or_foreign_records_cannot_promote(self, run, _):
        path = Path(f"release-images/{release.APPS[0]}.json")
        data = json.loads(path.read_text())
        data["run_id"] = "999"
        release.save(path, data)
        with self.assertRaises(ValueError):
            release.promote()
        path.unlink()
        with self.assertRaises(ValueError):
            release.promote()
        run.assert_not_called()

    @patch.object(release, "manifest")
    def test_verify_rejects_changed_digest_and_missing_platform(self, manifest):
        manifest.return_value = ("sha256:" + "b" * 64, {})
        with self.assertRaises(ValueError):
            release.verify_image(release.APPS[0], "5.4.10", self.digest)
        manifest.return_value = (self.digest, {"manifests": [
            {"platform": {"os": "linux", "architecture": "amd64"}}]})
        with self.assertRaises(ValueError):
            release.verify_image(release.APPS[0], "5.4.10", self.digest)

    @patch.object(release, "validate", return_value=("5.4.10", "abc"))
    @patch.object(release, "manifest", return_value=("old", {}))
    @patch.object(release, "verify_image")
    @patch.object(release.subprocess, "run")
    def test_no_mutation_when_any_preflight_fails(self, run, verify, *_):
        verify.side_effect = [None, ValueError("digest mismatch")]
        with self.assertRaises(ValueError):
            release.promote()
        run.assert_not_called()

    @patch.object(release, "validate", return_value=("5.4.10", "abc"))
    @patch.object(release, "manifest", return_value=("old", {}))
    @patch.object(release, "verify_image")
    @patch.object(release.subprocess, "run")
    def test_partial_failure_records_results_and_uses_digest(self, run, *_):
        run.side_effect = [None, RuntimeError("push failed")]
        with self.assertRaises(RuntimeError):
            release.promote()
        records = json.loads(Path("promotion.json").read_text())
        self.assertEqual([x["status"] for x in records],
                         ["verified", "failed-or-unverified", "pending", "pending"])
        self.assertTrue(all(x["previous_latest"] == "old" for x in records))
        self.assertEqual(run.call_args_list[0].args[0][-1],
                         f"featbit/{release.APPS[0]}@{self.digest}")

    @patch.object(release, "validate", return_value=("5.4.10", "abc"))
    @patch.object(release, "manifest", return_value=("old", {}))
    @patch.object(release, "verify_image")
    @patch.object(release.subprocess, "run")
    def test_success_verifies_all_latest_digests(self, run, verify, *_):
        release.promote()
        self.assertEqual(run.call_count, 4)
        self.assertEqual(verify.call_count, 8)
        self.assertTrue(all(x["status"] == "verified"
                            for x in json.loads(Path("promotion.json").read_text())))


if __name__ == "__main__":
    unittest.main()
