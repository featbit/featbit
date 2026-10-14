# Interactive demo scenario

Requires `npm ci`, `npx playwright install chromium`, and browser access to the configured demo site (by default `https://featbit-samples.vercel.app`).

Run from `e2e/local-stack`:

```powershell
npm run test -- --scenario interactive-demo
```

Each run logs in with the default test account, creates an isolated project through the Projects UI, selects that project's Prod environment, and creates `game-runner` (boolean) and `difficulty-mode` (string: easy, normal, hard) through the Feature Flags UI.

The scenario opens the actual Get Started demo link and verifies that it references the isolated Prod client key and the current stack's ELS endpoint. Through the UI it enables the game, changes difficulty from easy to normal to hard and back to easy, then disables and re-enables the game. Assertions check the canvas, disabled message, and visible difficulty text without refreshing the demo page.

Successful runs switch to the bootstrap project and delete the isolated project through the Projects UI. Failed runs retain the project and save screenshots, redacted page snapshots, and step evidence under `.runs/<stack>/interactive-demo-*`. SDK keys are excluded from text evidence. With `--one-time`, stack teardown still removes the test data volumes even on failure; file evidence remains. `--all` runs the scenario against each stack using the current image selection.

The scenario uses real UI/API/SDK requests, without network mocks. A demo-site outage or inability to reach the local ELS from the browser fails the scenario.

Cleanup errors also fail the run. Evidence distinguishes completed browser checks (`checksPassed`) from project cleanup (`cleanup`), so a successful game interaction cannot hide a failing project deletion.
