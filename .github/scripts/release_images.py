"""Release checks and digest-based promotion for FeatBit's public Docker Hub images."""

import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.error import HTTPError
from urllib.parse import urlencode, quote
from urllib.request import Request, urlopen


APPS = ("featbit-ui", "featbit-api-server", "featbit-control-plane",
        "featbit-evaluation-server")
NUMBER = r"(?:0|[1-9][0-9]*)"
STABLE = rf"{NUMBER}\.{NUMBER}\.{NUMBER}"
VERSION = rf"{STABLE}(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?"
ACCEPT = ", ".join(("application/vnd.oci.image.index.v1+json",
                    "application/vnd.docker.distribution.manifest.list.v2+json",
                    "application/vnd.oci.image.manifest.v1+json",
                    "application/vnd.docker.distribution.manifest.v2+json"))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def json_request(url, headers=None):
    with urlopen(Request(url, headers=headers or {}), timeout=60) as response:
        return json.load(response)


def manifest(app, reference, missing_ok=False):
    # Public pull access: registry credentials never enter logs or saved artifacts.
    query = urlencode({"service": "registry.docker.io",
                       "scope": f"repository:featbit/{app}:pull"})
    token = json_request(f"https://auth.docker.io/token?{query}")["token"]
    request = Request(
        f"https://registry-1.docker.io/v2/featbit/{app}/manifests/{quote(reference, safe=':')}",
        headers={"Authorization": f"Bearer {token}", "Accept": ACCEPT})
    try:
        with urlopen(request, timeout=60) as response:
            raw = response.read()
    except HTTPError as error:
        # Authentication, rate-limit and network failures must never mean 'absent'.
        if missing_ok and error.code == 404:
            return None
        raise
    return "sha256:" + hashlib.sha256(raw).hexdigest(), json.loads(raw)


def verify_image(app, reference, digest):
    require(re.fullmatch(r"sha256:[0-9a-f]{64}", digest), "Invalid image digest")
    actual, document = manifest(app, reference)
    require(actual == digest, f"Digest mismatch: {app}:{reference}")
    platforms = {(entry.get("platform", {}).get("os"),
                  entry.get("platform", {}).get("architecture"))
                 for entry in document.get("manifests", [])}
    require({("linux", "amd64"), ("linux", "arm64")} <= platforms,
            f"Missing release platforms: {app}:{reference}")


def validate(stable=False):
    version = os.environ["VERSION"]
    require(re.fullmatch(STABLE if stable else VERSION, version), "Invalid release version")
    require(os.environ["GITHUB_REF"] == f"refs/tags/{version}",
            "Dispatch the workflow from the matching release tag")
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    require(commit == os.environ["GITHUB_SHA"], "Checkout does not match workflow commit")
    if Path(".env").exists():
        values = [line.split("=", 1)[1].strip() for line in Path(".env").read_text().splitlines()
                  if line.startswith("FEATBIT_VERSION=")]
        require(values == [version], ".env version does not match release tag")
    return version, commit


def preflight():
    version, _ = validate()
    for app in APPS:
        require(manifest(app, version, missing_ok=True) is None,
                f"Refusing to overwrite published tag: featbit/{app}:{version}")


def preflight_app():
    version, _ = validate()
    app = os.environ["APP"]
    require(app in APPS, "Unknown application")
    require(manifest(app, version, missing_ok=True) is None,
            f"Refusing to overwrite published tag: featbit/{app}:{version}")


def save(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n")


def record():
    version, commit = validate()
    app, digest = os.environ["APP"], os.environ["IMAGE_DIGEST"]
    require(app in APPS, "Unknown application")
    verify_image(app, version, digest)
    save(f"release-images/{app}.json", {
        "app": app, "version": version, "commit": commit, "digest": digest,
        "run_id": os.environ["GITHUB_RUN_ID"],
    })
    with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as summary:
        summary.write(f"- `featbit/{app}:{version}`: `{digest}`\n")


def validate_promotion():
    version, commit = validate(stable=True)
    run_id = os.environ["BUILD_RUN_ID"]
    require(re.fullmatch(r"[0-9]+", run_id), "Invalid build run ID")
    run = json_request(
        f"https://api.github.com/repos/{os.environ['GITHUB_REPOSITORY']}/actions/runs/{run_id}",
        {"Authorization": f"Bearer {os.environ['GH_TOKEN']}",
         "Accept": "application/vnd.github+json"})
    require(run["path"] == ".github/workflows/publish-docker-images.yml"
            and run["event"] == "workflow_dispatch"
            and run["head_sha"] == commit
            and run["head_branch"] == version
            and run["conclusion"] == "success",
            "Build run must be a successful release build for this exact tag and commit")


def promote():
    version, commit = validate(stable=True)
    files = list(Path("release-images").glob("*.json"))
    require({path.stem for path in files} == set(APPS), "Incomplete release digest records")
    records = []
    # Complete all checks and capture rollback digests before the first mutation.
    for app in APPS:
        data = json.loads(Path(f"release-images/{app}.json").read_text())
        require(data["app"] == app and data["version"] == version
                and data["commit"] == commit and data["run_id"] == os.environ["BUILD_RUN_ID"],
                f"Build record mismatch: {app}")
        verify_image(app, version, data["digest"])
        previous = manifest(app, "latest", missing_ok=True)
        records.append({**data, "previous_latest": previous[0] if previous else None,
                        "status": "pending"})
    save("promotion.json", records)
    for data in records:
        app, digest = data["app"], data["digest"]
        try:
            # A failed command may already have changed the remote tag.
            data["status"] = "attempting"
            save("promotion.json", records)
            subprocess.run(["docker", "buildx", "imagetools", "create", "--tag",
                            f"featbit/{app}:latest", f"featbit/{app}@{digest}"], check=True)
            verify_image(app, "latest", digest)
            data["status"] = "verified"
        except Exception:
            data["status"] = "failed-or-unverified"
            raise
        finally:
            save("promotion.json", records)


if __name__ == "__main__":
    commands = {"validate": validate, "preflight": preflight, "record": record,
                "preflight-app": preflight_app,
                "validate-promotion": validate_promotion, "promote": promote}
    commands[sys.argv[1]]()
