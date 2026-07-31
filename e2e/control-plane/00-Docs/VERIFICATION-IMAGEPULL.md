# Verifying the ImagePullBackOff Permanent Fix

This runbook proves that the permanent fix for `ImagePullBackOff` errors caused by TLS trust gaps is correctly integrated into the deployment pipeline. The fix automatically invokes `Trust-MinikubeCertificates.ps1` from within `Deploy-FeatBitClusters.ps1` whenever `CUSTOM_IMAGE_REGISTRY` and `TRUST_CERTIFICATES` are both set in `deployment.env`, writing Docker daemon registry trust to `/etc/docker/certs.d/<host>/ca.crt` inside each Minikube node and blocking deploy completion via `Assert-NoImagePullBackoff.ps1` if any pod remains in a pull-failure state. Running this runbook on a real environment confirms that the fix works on a cold start, survives a stop/start cycle, and that regressions are automatically detected — not silently ignored.

---

## Background

The original failure mode occurred when Minikube nodes pulled images from a custom registry backed by a private or corporate certificate authority. Because the Minikube node's Docker daemon had no knowledge of the CA, every image pull failed with `x509: certificate signed by unknown authority`, putting pods into `ImagePullBackOff` or `ErrImagePull`. The error was intermittent — it appeared only after cluster recreation or stop/start cycles — because the CA trust was installed manually and lost when the cluster was destroyed or stopped.

The permanent fix embeds CA trust installation directly into `Deploy-FeatBitClusters.ps1`. When `CUSTOM_IMAGE_REGISTRY` is set and `TRUST_CERTIFICATES` is non-empty, the deploy script automatically calls `Trust-MinikubeCertificates.ps1` before applying any Kubernetes manifests. That script downloads each CA bundle listed in `TRUST_CERTIFICATES`, copies it into the Minikube node, runs `update-ca-certificates`, and writes a Docker daemon trust entry at `/etc/docker/certs.d/<registry-host>/ca.crt`, then waits for the daemon to become responsive before proceeding. No manual operator action is required. An escape hatch (`INSECURE_CUSTOM_REGISTRY=true`) is also documented for operators who cannot install a CA but accept the security trade-off of disabled TLS verification.

This runbook proves three things: (1) the fix eliminates `ImagePullBackOff` on a cold start without any manual cert steps; (2) the trust survives a `minikube stop`/`minikube start` cycle when `Deploy-FeatBitClusters.ps1` is re-run with `-SkipClusterCreation`; and (3) `Assert-NoImagePullBackoff.ps1` genuinely fails when trust is broken, so operators can rely on it as a regression gate — it does not trivially pass.

---

## Prerequisites

- `deployment.env` filled out with at minimum:
  - `CUSTOM_IMAGE_REGISTRY=myregistry.example.com` (your registry hostname or hostname:port)
  - `TRUST_CERTIFICATES=my-corp-ca|https://certs.example.com/ca.crt|/usr/local/share/ca-certificates/my-corp-ca.crt`
  - `CUSTOM_REGISTRY_USERNAME` / `CUSTOM_REGISTRY_PASSWORD` (if your registry requires authentication)
- `minikube`, `kubectl`, `docker`, and `pwsh` (PowerShell 7.6+) installed and on `$PATH`
- Both `west` and `east` clusters either absent (for V1) or already deployed (for V2 and V3)
- Network access from the host to `TRUST_CERTIFICATES` download URLs
- **Working directory for all commands:** `e2e\control-plane\01-Infrastructure\`
- **Estimated runtime:** ~30 minutes for V1–V3; V4 adds another 20 minutes

---

## V1 — Cold-Start Succeeds Without Manual Cert Steps

### Goal

Prove that a fresh deploy with no pre-existing trust succeeds end-to-end without any manual invocation of `Trust-MinikubeCertificates.ps1`.

### Steps

1. Delete both clusters so the test starts from a truly cold state:

   ```powershell
   minikube delete -p west
   minikube delete -p east
   ```

   Expected output: `🔥  Deleting "west" in docker ...` and `🔥  Deleting "east" in docker ...` (or equivalent for your driver). Both commands exit 0. If a cluster did not exist the command still exits 0 with a message such as `"west" profile does not exist`.

2. Confirm `deployment.env` contains the required keys (substitute your actual file path if you have not `cd`'d to `01-Infrastructure`):

   ```powershell
   Select-String -Path .\deployment.env -Pattern "^CUSTOM_IMAGE_REGISTRY=|^TRUST_CERTIFICATES="
   ```

   Expected: two matching lines — one for each key, both non-empty.

3. Run a full cluster creation and deployment:

   ```powershell
   .\Deploy-FeatBitClusters.ps1 -RecreateClusters
   ```

   Watch for the `Installing Registry TLS Trust` step in the output. You should see:

   ```
   Registry trust host defaulted from deployment.env: myregistry.example.com
   ✓ Registry TLS trust installed in both clusters
   ```

   The script then continues to deploy infrastructure and applications.

4. Once the deploy script exits 0, run the assertion explicitly to confirm no pods are in a pull-failure state:

   ```powershell
   .\Assert-NoImagePullBackoff.ps1 -Contexts west,east -Namespaces featbit -TimeoutSeconds 120
   ```

### Expected output

```
[poll 1/24] west/featbit: 0 pull-backoff pod(s) | east/featbit: 0 pull-backoff pod(s)

✓ west/featbit: all pods healthy (N pods checked)
✓ east/featbit: all pods healthy (N pods checked)

PASS: zero ImagePullBackOff/ErrImagePull pods across 2 cluster(s) x 1 namespace(s)
```

The exact pod count (`N`) varies by deployment mode. The key signals are `✓` on both lines and the final `PASS:` banner.

### Pass criterion

`Assert-NoImagePullBackoff.ps1` exits 0 and prints the `PASS:` banner. No pod in `west` or `east` in the `featbit` namespace has a waiting reason of `ImagePullBackOff`, `ErrImagePull`, `Init:ImagePullBackOff`, `Init:ErrImagePull`, `RegistryUnavailable`, or `ImageInspectError`.

---

## V2 — Resume-After-Stop Survives

### Goal

Prove that the trust persists across a `minikube stop`/`minikube start` cycle when `Deploy-FeatBitClusters.ps1` is re-run with `-SkipClusterCreation`.

### Steps

1. Tear down running infrastructure using the teardown script appropriate for your platform (all are in `01-Infrastructure/`):

   ```powershell
   # Windows Hyper-V
   .\windows-hyperv\Teardown-HyperV.ps1

   # Ubuntu / Debian Linux
   .\ubuntu\Teardown-Ubuntu.ps1
   ```

   Or, to stop only the Minikube clusters without removing them:

   ```powershell
   minikube stop -p west
   minikube stop -p east
   ```

   Expected: clusters stop cleanly; commands exit 0.

2. Start both clusters:

   ```powershell
   minikube start -p west
   minikube start -p east
   ```

   Expected: both clusters reach `Running` state; commands exit 0.

3. Re-deploy FeatBit, skipping cluster creation (trust will be re-applied automatically):

   ```powershell
   .\Deploy-FeatBitClusters.ps1 -SkipClusterCreation
   ```

   Watch for `✓ Registry TLS trust installed in both clusters` in the output.

4. Verify no pull-backoff pods:

   ```powershell
   .\Assert-NoImagePullBackoff.ps1 -Contexts west,east -Namespaces featbit -TimeoutSeconds 120
   ```

### Expected output / Pass criterion

`Assert-NoImagePullBackoff.ps1` exits 0 and prints the `PASS:` banner. No `ImagePullBackOff`/`ErrImagePull` pods in either cluster. This confirms the trust is not just a one-time cold-start artefact — it is reliably re-applied on every `Deploy-FeatBitClusters.ps1` run.

---

## V3 — Trust Regression Is Detected

### Goal

Prove that `Assert-NoImagePullBackoff.ps1` actually fails when trust is broken, not just trivially passes. This validates that the assertion script is a meaningful regression gate.

### Steps

1. Break Docker daemon trust on the `west` cluster by moving the `certs.d` directory out of the way. Replace `<your-registry-host>` with the value of `CUSTOM_IMAGE_REGISTRY` from your `deployment.env`:

   ```powershell
   minikube ssh -p west -- "sudo mv /etc/docker/certs.d/<your-registry-host> /etc/docker/certs.d/<your-registry-host>.bak && sudo systemctl restart docker"
   ```

   Wait ~10 seconds for the daemon to restart. You can confirm it is back by running:

   ```powershell
   minikube ssh -p west -- "docker info >/dev/null 2>&1 && echo daemon-ready"
   ```

   Expected: `daemon-ready`.

2. Force a re-pull on a pod sourced from the custom registry so the daemon retries image pulls with the broken trust. `kafka-ui` is a reliable choice because it is an infrastructure deployment sourced from the custom registry:

   ```powershell
   kubectl --context west rollout restart deployment/kafka-ui -n featbit
   ```

   Wait ~15 seconds for the rollout to create a new pod and encounter the pull error:

   ```powershell
   kubectl --context west get pods -n featbit | Select-String "kafka-ui"
   ```

   Expected: at least one `kafka-ui` pod shows `ImagePullBackOff` or `ErrImagePull` in its status column.

3. Run the assertion and confirm it fails:

   ```powershell
   .\Assert-NoImagePullBackoff.ps1 -Contexts west -Namespaces featbit -TimeoutSeconds 60
   ```

   Expected exit code: **1**.

   Expected output (partial — exact pod name will differ):

   ```
   FAIL: ImagePullBackOff detected after 60s

   ✗ west/featbit/kafka-ui-<hash>
       Container        : kafka-ui
       Image            : myregistry.example.com/...
       Waiting reason   : ImagePullBackOff
       Last event       : Failed to pull image "myregistry.example.com/...": ... x509: certificate signed by unknown authority
       Suggested action : See https://kubernetes.io/docs/concepts/containers/images/...
   ```

   The presence of `x509: certificate signed by unknown authority` in the `Last event` line confirms the root cause.

4. Restore trust by moving the `certs.d` directory back and restarting the daemon. Replace `<your-registry-host>` with the same value used in step 1:

   ```powershell
   minikube ssh -p west -- "sudo mv /etc/docker/certs.d/<your-registry-host>.bak /etc/docker/certs.d/<your-registry-host> && sudo systemctl restart docker"
   ```

   Wait ~10 seconds for the daemon to restart.

5. Wait for `kafka-ui` to recover (Kubernetes will retry the pull automatically), then re-run the assertion:

   ```powershell
   .\Assert-NoImagePullBackoff.ps1 -Contexts west -Namespaces featbit -TimeoutSeconds 120
   ```

   Expected exit code: **0**. Expected final line: `PASS: zero ImagePullBackOff/ErrImagePull pods across 1 cluster(s) x 1 namespace(s)`.

### Pass criterion

Step 3 exits **1** with a diagnostic block referencing `kafka-ui` and `x509: certificate signed by unknown authority`. Step 5 exits **0** with the `PASS:` banner. Both signals match expectations — the assertion is not a no-op.

---

## V4 — Insecure-Fallback Path Works for Users Without a CA

### Goal

Prove the documented escape hatch for operators who cannot install a CA certificate (e.g., the CA is inaccessible from the Minikube network, or certificate files are unavailable). `INSECURE_CUSTOM_REGISTRY=true` configures Minikube with `--insecure-registry` so the Docker daemon skips TLS verification for the specified host.

### Steps

1. Edit `deployment.env`: comment out (or blank) `TRUST_CERTIFICATES` and add `INSECURE_CUSTOM_REGISTRY=true`:

   ```powershell
   # In deployment.env:
   #TRUST_CERTIFICATES=
   INSECURE_CUSTOM_REGISTRY=true
   ```

2. Recreate both clusters and deploy with the updated configuration:

   ```powershell
   .\Deploy-FeatBitClusters.ps1 -RecreateClusters
   ```

   Watch for the warning lines emitted by the deploy script:

   ```
   WARNING: INSECURE_CUSTOM_REGISTRY=true — TLS verification will be DISABLED for 'myregistry.example.com' in the west cluster. Configure TRUST_CERTIFICATES instead for proper TLS trust.
   WARNING: INSECURE_CUSTOM_REGISTRY=true — TLS verification will be DISABLED for 'myregistry.example.com' in the east cluster. Configure TRUST_CERTIFICATES instead for proper TLS trust.
   ```

   Confirm the deploy script exits 0.

3. Run the assertion:

   ```powershell
   .\Assert-NoImagePullBackoff.ps1 -Contexts west,east -Namespaces featbit -TimeoutSeconds 120
   ```

4. Verify that the Docker daemon in the `west` cluster has the custom registry configured as insecure. Replace `<your-registry-host>` with your `CUSTOM_IMAGE_REGISTRY` value:

   ```powershell
   minikube ssh -p west -- "docker info 2>&1 | grep -A 5 Insecure"
   ```

   Expected output:

   ```
    Insecure Registries:
     myregistry.example.com
     127.0.0.0/8
   ```

   The custom registry hostname must appear in the `Insecure Registries` section.

### Expected output / Pass criterion

- The deploy script prints the `INSECURE_CUSTOM_REGISTRY=true` warning for both clusters and exits 0.
- `Assert-NoImagePullBackoff.ps1` exits 0 and prints the `PASS:` banner.
- `docker info` output from the `west` node lists `CUSTOM_IMAGE_REGISTRY` under `Insecure Registries`.

> **Security note:** `INSECURE_CUSTOM_REGISTRY=true` disables TLS verification for the registry host. It is acceptable only in development or air-gapped test environments. For production or shared QA environments, configure `TRUST_CERTIFICATES` instead and use the CA-trust path proven by V1–V3.

---

## Failure-Mode Decision Tree

When `Assert-NoImagePullBackoff.ps1` exits 1, use the following tree to diagnose the root cause before rerunning the fix.

- **`x509: certificate signed by unknown authority`** in `Last event`
  → The Minikube Docker daemon does not trust the registry's CA.
  → Verify `TRUST_CERTIFICATES` is set in `deployment.env` and non-empty.
  → Re-run `.\Deploy-FeatBitClusters.ps1 -SkipClusterCreation` to re-apply trust.
  → To confirm trust was written: `minikube ssh -p west -- "ls -la /etc/docker/certs.d/<your-registry-host>/"` — `ca.crt` must exist.
  → See V3 for a step-by-step diagnosis and recovery flow.

- **`401 Unauthorized`** or **`unauthorized: authentication required`**
  → Image pull credentials are missing or wrong.
  → Verify `CUSTOM_REGISTRY_USERNAME` and `CUSTOM_REGISTRY_PASSWORD` in `deployment.env`.
  → Confirm the pull secret was created: `kubectl --context west -n featbit get secret registry-credentials`
  → If the secret is missing, re-run `.\Deploy-FeatBitClusters.ps1 -SkipClusterCreation`.

- **`manifest unknown`** or **`repository not found`**
  → The image path in the manifest does not match your registry's actual namespace layout.
  → Check `kubernetes\infra-image-map.local.json` — the image paths must reflect your registry's layout (e.g., `myregistry.example.com/dockerhub/library/mongo:6` not `myregistry.example.com/mongo:6`).
  → Pull the image manually to confirm the exact path: `minikube ssh -p west -- "docker pull myregistry.example.com/<path>:<tag>"`.

- **`no such host`** or DNS resolution failure
  → The registry hostname is not reachable from inside the Minikube node.
  → From the host, verify DNS: `nslookup myregistry.example.com`
  → From inside the node: `minikube ssh -p west -- "nslookup myregistry.example.com"`
  → If DNS fails inside the node but works on the host, the Minikube node may be using a different DNS server. Check `minikube ssh -p west -- "cat /etc/resolv.conf"`.

- **`context not found`** or cluster unreachable (kubectl exits non-zero)
  → The Minikube cluster is not running or the kubeconfig entry is missing.
  → Run: `minikube status -p west` and `minikube status -p east`
  → If stopped: `minikube start -p west; minikube start -p east`
  → Refresh kubeconfig: `.\Deploy-FeatBitClusters.ps1 -SkipClusterCreation`

---

## When the Fix Is Considered Permanently In Place

Tick all four to declare the fix verified for your environment:

- [ ] **V1** passed on the operator's machine — cold-start deploy succeeded without any manual cert steps.
- [ ] **V2** passed after a `minikube stop`/`minikube start` cycle — trust survived and re-applied automatically.
- [ ] **V3** demonstrated regression detection: step 3 exited 1 (with `x509` in the diagnostic block) and step 5 exited 0 (after trust was restored).
- [ ] **V4** passed for the documented insecure fallback path — `INSECURE_CUSTOM_REGISTRY=true` deployed successfully and `docker info` confirmed the registry is listed as insecure.

All four checks are reproducible from this runbook using only placeholder values. Substitute `myregistry.example.com`, `certs.example.com`, and `my-corp-ca` with the actual values from your `deployment.env` when running in your environment.
