# .NET Server SDK scenario

Requires the .NET 8 SDK. Run from `e2e/local-stack`:

```powershell
npm run test -- --stack postgres --scenario sdk-server
```

[index.mjs](./index.mjs) builds and starts [ServerSdkProbe.csproj](./ServerSdkProbe.csproj). The probe keeps one .NET Server SDK client connected while the scenario creates a unique flag and segment, evaluates tester and guest users, changes flag targeting, and changes segment membership. Each phase checks the returned value, variation ID, and evaluation reason. Successful runs remove their flag and segment; failed runs retain them for diagnosis. Evidence is saved under `.runs/<stack>/` without the SDK secret.

Run with `--all` to cover all five stack configurations. The flag and segment setup is shared with the Client SDK scenario in [shared/sdk-fixture.mjs](../shared/sdk-fixture.mjs).
