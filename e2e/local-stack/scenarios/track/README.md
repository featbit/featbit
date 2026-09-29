# Track scenario

Run from `e2e/local-stack`:

```powershell
npm run test -- --stack postgres --scenario track
```

The scenario calls the public Track API with end-user, exposure, metric, and combined payloads. It waits for end-user and event persistence, then checks the change in the Insights aggregation. It uses the initialized Dev environment and saves run evidence under `.runs/<stack>/`.

Implementation: [index.mjs](./index.mjs). Use `--all` to run it against all five stack configurations.
