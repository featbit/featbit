# Testing conventions

This document defines the standard for tests in the **back-end** (`modules/back-end`) and **evaluation-server** (`modules/evaluation-server`) modules. All new tests must follow it; existing tests are migrated opportunistically.

## 1. Project layout

Each production project gets a matching test project under `tests/`:

```
modules/<module>/
  src/
    Api/
    Application/         (back-end only)
    Domain/
    Infrastructure/
    Streaming/           (evaluation-server only)
  tests/
    TestBase/                       # module-agnostic shared helpers
    Domain.UnitTests/
    Application.UnitTests/          (back-end only)
    Infrastructure.UnitTests/
    Streaming.UnitTests/            (evaluation-server only)
    Application.IntegrationTests/   # WebApplicationFactory-based
    Infrastructure.IntegrationTests/ # Testcontainers, local-only (Category=Integration)
```

- **`TestBase`** holds module-agnostic helpers only (loggers, generic builders, primitive fixtures). Stubs, mocks, or anything that references Domain/Application types do **not** belong here.
- **`Infrastructure.UnitTests`** exists in *both* modules (back-end and evaluation-server) — every project that ships under `src/` has a matching `<Project>.UnitTests` peer.
- **Integration tests** (anything that boots `WebApplicationFactory<Program>`, hits the network/FS/DB, or shares an expensive fixture) live in `Application.IntegrationTests/` (in-process host) or `Infrastructure.IntegrationTests/` (real backing stores via Testcontainers). See §8 and §12.
- All other tests are **unit tests** and live in `<Project>.UnitTests/`.

## 2. Folder mirroring

**Test folders mirror the source folder tree under the matching test project.**

For a source file at `src/<Project>/<Path>/<Type>.cs`, its tests live at:

- `tests/<Project>.UnitTests/<Path>/<Type>Tests.cs` (unit), and/or
- `tests/Application.IntegrationTests/<Path>/<Type>Tests.cs` (integration)

`<Path>` matches the source path exactly — casing, nested folders, all of it. Test namespaces mirror the folder.

**Allowed exceptions:**

1. **Cross-cutting integration scenarios** that exercise multiple source folders may live in a scenario-named folder (e.g., `WebSockets/`, `Configuration/`, `Authentication/`). These describe the behavior under test, not a single source type.
2. **Test infrastructure** lives in dedicated, non-mirrored folders: `Stubs/`, `Builders/`, `Fixtures/`.
3. **`TestApp` and project-wide harnesses** live at the test project root.

## 3. Test class conventions

| Aspect | Rule |
|---|---|
| Name | `<SystemUnderTest>Tests` (e.g., `ConnectionManagerTests`). Singular `Test` is not used. |
| Visibility | `public class` — no `[TestClass]` or fixture attributes on the class. |
| One class per SUT | Don't split a class into multiple files unless navigation actively suffers. Partial classes are not the default. |
| Namespace | Mirrors the folder path. |

### Setup pattern (choose per class, never mix within a class)

1. **Default — constructor + private fields.** Use when every test shares the same SUT shape and setup is ≤ ~5 lines.
2. **`CreateSut(...)` factory method.** Use when tests need to vary dependencies. The moment a test would override a constructor-built field, refactor the *whole class* to a factory. Signature pattern:

   ```csharp
   private static IdentityService CreateSut(
       Mock<IPasswordHasher<User>>? hasher = null,
       JwtOptions? jwt = null,
       IRefreshTokenService? tokens = null) =>
       new(null!, (hasher ?? new()).Object, tokens ?? Mock.Of<IRefreshTokenService>(), jwt ?? new());
   ```

3. **`IClassFixture<T>`** — only for genuinely expensive shared state (web hosts, real DBs, generated keys). Never for cheap mocks. `TestApp` is the canonical example.

## 4. Test method conventions

- **Name:** `Method_Scenario_ExpectedResult` (e.g., `DispatchAsync_NoHandler_LogsWarning`, `LoginByEmail_InvalidPayload_ReturnsValidationError`).
- **`[Fact]`** for single cases. **`[Theory] + [InlineData]`** for primitives. **`[Theory] + [MemberData]`** with a named `public static IEnumerable<object[]>` property for complex inputs.
- **Body:** implicit AAA, separated by blank lines. No `// Arrange / // Act / // Assert` comments. Keep tests short enough that the structure is self-evident.
- **Async:** `async Task`-returning. Pass `CancellationToken.None` explicitly when an API requires it.
- **Assertions:** xUnit `Assert.*` only. Always `Assert.Equal(expected, actual)` — never reversed.

## 5. Libraries

| Concern | Library | Notes |
|---|---|---|
| Test framework | xUnit | already standard |
| Mocking | Moq | `Mock<T>`, `Mock.Of<T>(...)`, `SetupSequence`/`InSequence` for ordering |
| Logger | `Microsoft.Extensions.Diagnostics.Testing` `FakeLogger<T>` | **never** `Mock<ILogger<T>>` |
| Snapshot | Verify.Xunit | see §7 |
| Coverage | coverlet.collector (referenced per test project, not via `TestBase` with `PrivateAssets=all`) | |

No FluentAssertions, Shouldly, NSubstitute, AutoFixture, or Bogus.

### Detecting forbidden libraries

Run this at the repo root before sending a test-related PR:

```powershell
rg -n --type cs '(FluentAssertions|Shouldly|NSubstitute|AutoFixture|Bogus|Mock<ILogger)' modules\back-end\tests modules\evaluation-server\tests
```

A clean run produces no output. Any hit must be replaced with the approved equivalent (Moq for mocks, `FakeLogger<T>` for loggers) before merging.

## 6. Test data and builders

- **Fluent `*Builder` classes** are the standard way to construct non-trivial test inputs. Each builder lives in a `Builders/` folder in the test project that uses it.
- If two test projects need the same builder, promote it to `TestBase/Builders/`.
- **`TestData`** classes are reserved for primitive constants (GUIDs, token strings, sample JSON). They are not a substitute for builders.
- **Do not** ship test data from `src/`. Where production code legitimately needs deterministic seed data (e.g. the eval-server fake cache/MQ providers that power local-dev mode), put it in `src` under a non-test name (`FakeSeedData`) and forward those members through a `TestData` class in `tests/TestBase`. Tests still call `TestData.X`; production never references anything named `Test*`.
- Randomized data generators (Bogus, AutoFixture) are not used — tests must be deterministic.

## 7. Snapshot testing (Verify.Xunit)

**Use Verify for:**

- HTTP responses (status + headers + body together).
- Serialization round-trips, generated SQL, generated config.
- Output where explicit assertions would exceed ~10 `Assert` calls.

**Do not use Verify for:**

- Unit tests of single properties, booleans, counts.
- Behavior tests where the explicit assertion documents intent better than a snapshot (e.g., `Assert.True(diff.IsDifferent)`).

**Discipline:** every `*.received.txt → *.verified.txt` diff must be reviewed in the PR — never blindly accepted.

## 8. Unit vs integration

Unit tests must **not**:

- Open sockets, talk to a real DB, Redis, Kafka, or any external process.
- Read from or write to the filesystem (other than reading embedded test fixtures).
- Use `Thread.Sleep` or bare `Task.Delay`.

If a test needs any of those, it belongs in `Application.IntegrationTests/` (in-process host) or `Infrastructure.IntegrationTests/` (real Mongo/Postgres/Redis/Kafka via Testcontainers — see §12).

## 9. Time and timing

- `Thread.Sleep` is **forbidden** in tests.
- Bare `Task.Delay` is **forbidden** in tests.
- For time-dependent code, inject `TimeProvider` and use `FakeTimeProvider` (`Microsoft.Extensions.TimeProvider.Testing`).
- For "wait until condition" synchronization, use `TaskCompletionSource`, signal handles, or polling with a hard timeout (`Assert.True(await WaitForAsync(...))`).

## 10. CI and coverage

- Both modules build and run their full test suite on every PR (`build-and-test-api.yml`, `build-and-test-els.yml`).
- CI runs with `--filter "Category!=Integration"`, which **builds** `Infrastructure.IntegrationTests` (proving it compiles) but **skips** every test inside it. Testcontainers-backed tests are local-only — see §12.
- Coverage is collected via `dotnet test --collect:"XPlat Code Coverage"` and published as a workflow artifact (`coverage-back-end`, `coverage-evaluation-server`). **No threshold gate yet** — report only, until baselines stabilize.
- The `coverlet.collector` package must be referenced directly by each test project (not transitively through `TestBase` with `PrivateAssets="all"`, which would silently break `dotnet test --collect:"XPlat Code Coverage"`).

### Baseline (captured 2026-06-25)

These are the starting coverage numbers as of the introduction of this standard. Use them as the "before" point when evaluating whether subsequent work moves the needle.

**Evaluation server** — 132 tests, **41% line / 40% block** overall:

| Module | Lines covered | Coverage |
|---|---|---|
| Domain | 360/570 | 63% |
| Streaming | 724/1,174 | 62% |
| Infrastructure | 131/1,214 | 11% |

**Back-end** — 171 tests, **~9% line / ~5% block** overall:

| Module | Lines covered | Coverage |
|---|---|---|
| Api | 539/2,728 | 20% |
| Domain | 464/3,120 | 15% |
| Infrastructure | 334/6,836 | 5% |
| Application | 100/3,494 | 3% |

## 11. Required cleanups (tracked separately)

These items violate the rules above and will be migrated as work touches them:

- **eval-server:** move `src/Domain/Shared/TestData.cs` → `tests/TestBase/TestData.cs`.
- **eval-server:** move `tests/Streaming.UnitTests/Shared/*` → `tests/Domain.UnitTests/Shared/` (tests target `Domain.Shared` types).
- **eval-server:** rename `tests/Domain.UnitTests/Evaluation/DispatchAlgorithmTest.cs` → `DispatchAlgorithmTests.cs`.
- **back-end:** move `tests/Application.IntegrationTests/Identity/IdentityServiceTests.cs` → `tests/Application.UnitTests/Identity/IdentityServiceTests.cs` (no integration host used).
- **back-end:** rename `tests/Application.UnitTests/HandlebarTemplate/` to match the actual source path.
- **back-end:** fix `Assert.Equal(actual, expected)` argument order in `StringHelperTests.cs`.
- **both modules:** add `coverlet.collector` PackageReference directly to each test csproj.

## 12. Backend-integration tests (Testcontainers)

The `Infrastructure.IntegrationTests` project in each module covers code paths that hit a **real** Mongo / Postgres / Redis / Kafka instance. We use [Testcontainers for .NET](https://dotnet.testcontainers.org/) so every contributor gets a deterministic, throw-away backing store with no manual setup beyond `docker` being installed.

### Local-only — never in CI

- Every test in these projects is tagged `[Trait("Category", "Integration")]` (via the `IntegrationTestBase` base class).
- Both module workflows run `dotnet test --filter "Category!=Integration"`, so the project still **builds** in CI (catching compile breaks) but no container is ever started by a GitHub-hosted runner.
- Running locally: `dotnet test tests/Infrastructure.IntegrationTests/Infrastructure.IntegrationTests.csproj` from the module root. If Docker isn't running, each test resolves to **Skipped** with the reason `Docker is not available...` rather than failing — courtesy of the `[DockerFact]` / `[DockerTheory]` attributes.

### Project layout

```
tests/Infrastructure.IntegrationTests/
  Fixtures/
    MongoDbFixture.cs        # IAsyncLifetime, owns one MongoDbContainer per assembly
    PostgresFixture.cs
    RedisFixture.cs
    KafkaFixture.cs
    Collections.cs           # [CollectionDefinition] per backend — share one container
  Support/
    DockerAvailability.cs    # cached `docker info` probe
    DockerFactAttribute.cs   # [DockerFact] / [DockerTheory] — skip when Docker is down
    IntegrationTestBase.cs   # [Trait("Category", "Integration")] applied here
  Smoke/                     # one trivial test per fixture, proves the plumbing works
```

### Authoring rules

1. **Every test class derives from `IntegrationTestBase`** so the `Category=Integration` trait is applied automatically. Do **not** add `[Trait]` per-method.
2. **Every test method uses `[DockerFact]` or `[DockerTheory]`** — never plain `[Fact]` in this project. This is what makes the suite skip cleanly on a Docker-less machine instead of failing.
3. **Share containers via the per-backend collection.** Add `[Collection(MongoCollection.Name)]` (or `PostgresCollection` / `RedisCollection` / `KafkaCollection`) to the class and inject the fixture through the constructor. Don't `new` a container inside a test.
4. **Reset state between tests yourself.** Collection fixtures live for the whole assembly run; each test must drop/recreate its own collections, schemas, keys, or topics. Don't rely on container restart for isolation.
5. **Folder mirroring still applies.** A test for `src/Infrastructure/Persistence/Mongo/FlagRepository.cs` lives at `tests/Infrastructure.IntegrationTests/Persistence/Mongo/FlagRepositoryTests.cs`. The `Smoke/` and `Fixtures/` folders are the only allowed exceptions.
6. **No mocks here.** This project exists specifically because mocks aren't faithful to the real driver behaviour. If a scenario can be expressed with mocks, it belongs in `Infrastructure.UnitTests`.

### Why a separate project per module (instead of one shared)?

The back-end and evaluation-server `Infrastructure` assemblies are independent — different `IOptions` shapes, different DI extensions, different driver wrappers. Sharing a single integration project would force a cross-module reference graph that doesn't exist in production. The per-module fixtures are intentionally near-identical so they're easy to keep in sync, but they own their own `IServiceCollection` wiring.

