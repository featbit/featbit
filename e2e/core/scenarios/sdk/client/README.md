# JS Client SDK scenario

Install dependencies and Chromium, then run from `e2e/core`:

```powershell
npm ci
npx playwright install chromium
npm run test -- --scenario sdk-client
```

[index.mjs](./index.mjs) uses [@featbit/js-client-sdk](https://www.npmjs.com/package/@featbit/js-client-sdk) 4.3.6. It creates a client with `FbClientBuilder` in each of two isolated Chromium browser contexts, one for tester and one for guest, and waits for `waitForInitialization()`. Both clients stay connected while the scenario changes flag targeting and segment membership. Each page displays the flag value in two outputs, updated independently by `update` and `update:<flagKey>` subscriptions. Each phase checks the SDK value and evaluation reason, the displayed values, and callback payloads and results. Evidence includes these subscription results without the SDK secret. Successful runs remove their unique flag and segment; failed runs retain them for diagnosis only when `--keep-environment` preserves the environment. Evidence is saved under `.runs/<run-id>/<stack>/`.

Use `npm run test:all -- --local` to run all scenarios across all five stack configurations. The flag and segment setup is shared with the Server SDK scenario in [sdk/fixture.mjs](../fixture.mjs).
