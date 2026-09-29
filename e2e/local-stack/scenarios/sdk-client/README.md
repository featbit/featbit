# JS Client SDK scenario

Install dependencies and Chromium, then run from `e2e/local-stack`:

```powershell
npm ci
npx playwright install chromium
npm run test -- --stack postgres --scenario sdk-client
```

[index.mjs](./index.mjs) uses the pinned [@featbit/js-client-sdk](https://www.npmjs.com/package/@featbit/js-client-sdk) package. It creates a client with `FbClientBuilder` in each of two isolated Chromium browser contexts, one for tester and one for guest, and waits for `waitForInitialization()`. Both clients stay connected while the scenario changes flag targeting and segment membership; each phase checks the variation seen by each user. Successful runs remove their unique flag and segment; failed runs retain them for diagnosis. Evidence is saved under `.runs/<stack>/` without the SDK secret.

Run with `--all` to cover all five stack configurations. The flag and segment setup is shared with the Server SDK scenario in [shared/sdk-fixture.mjs](../shared/sdk-fixture.mjs).
