# Track scenario

Run from `e2e/core`:

```powershell
npm run test -- --scenario track
```

The scenario calls the public Track API with end-user, exposure, metric, and combined payloads. It waits for end-user and event persistence, checks persisted metric values, then verifies Insights counts and per-variation experiment users, conversions, and numeric sums. A metric-only user must not contribute to experiment statistics. Each run creates an isolated flag, removes it on success, and retains it on failure only when `--keep-environment` preserves the environment. It uses the initialized Dev environment and saves run evidence under `.runs/<run-id>/<stack>/`.

Implementation: [index.mjs](./index.mjs). Use `npm run test:all -- --local` to run all scenarios across all five stack configurations.
