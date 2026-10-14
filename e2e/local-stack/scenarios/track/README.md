# Track scenario

Run from `e2e/local-stack`:

```powershell
npm run setup -- --stack postgres
npm run test -- --scenario track
```

The scenario calls the public Track API with end-user, exposure, metric, and combined payloads. It waits for end-user and event persistence, checks persisted metric values, then verifies Insights counts and per-variation experiment users, conversions, and numeric sums. A metric-only user must not contribute to experiment statistics. Each run creates an isolated flag, removes it on success, and retains it on failure. It uses the initialized Dev environment and saves run evidence under `.runs/<stack>/`.

Implementation: [index.mjs](./index.mjs). Use `--all` to run it against all five stack configurations.
