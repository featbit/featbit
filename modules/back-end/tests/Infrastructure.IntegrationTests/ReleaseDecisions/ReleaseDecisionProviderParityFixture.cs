using Application.ExperimentStats;
using Application.FeatureFlags;
using Application.Services;
using Dapper;
using Domain.EndUsers;
using Domain.FeatureFlags;
using Domain.ReleaseDecisions;
using Domain.Targeting;
using Infrastructure.OLAP.ClickHouse;
using Infrastructure.Persistence.EntityFrameworkCore;
using Infrastructure.Persistence.MongoDb;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using Npgsql;
using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;

namespace Infrastructure.IntegrationTests.ReleaseDecisions;

public sealed class ReleaseDecisionProviderParityFixture : IAsyncLifetime
{
    public static readonly Guid EnvId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    public const string FlagKey = "checkout-flow";
    public const string MetricEvent = "purchase";

    private readonly IContainer _postgres = new ContainerBuilder()
        .WithImage("postgres:15.10")
        .WithEnvironment("POSTGRES_USER", "postgres")
        .WithEnvironment("POSTGRES_PASSWORD", "please_change_me")
        .WithEnvironment("POSTGRES_DB", "featbit")
        .WithPortBinding(5432, true)
        .WithWaitStrategy(Wait.ForUnixContainer().UntilInternalTcpPortIsAvailable(5432))
        .Build();

    private readonly IContainer _mongo = new ContainerBuilder()
        .WithImage("mongo:5.0.32")
        .WithEnvironment("MONGO_INITDB_ROOT_USERNAME", "admin")
        .WithEnvironment("MONGO_INITDB_ROOT_PASSWORD", "password")
        .WithPortBinding(27017, true)
        .WithWaitStrategy(Wait.ForUnixContainer().UntilInternalTcpPortIsAvailable(27017))
        .Build();

    private readonly IContainer _clickHouse = new ContainerBuilder()
        .WithImage("clickhouse/clickhouse-server:23.7")
        .WithPortBinding(8123, true)
        .WithWaitStrategy(Wait.ForUnixContainer().UntilInternalTcpPortIsAvailable(8123))
        .Build();

    public async Task InitializeAsync()
    {
        DefaultTypeMap.MatchNamesWithUnderscores = true;

        await Task.WhenAll(
            _postgres.StartAsync(),
            _mongo.StartAsync(),
            _clickHouse.StartAsync()
        );

        await InitializePostgresAsync();
        await InitializeClickHouseAsync();
    }

    public async Task DisposeAsync()
    {
        await Task.WhenAll(
            _postgres.DisposeAsync().AsTask(),
            _mongo.DisposeAsync().AsTask(),
            _clickHouse.DisposeAsync().AsTask()
        );
    }

    public async Task SeedScenarioAsync()
    {
        await ClearAsync();

        var exposures = Scenario.Exposures;
        var metrics = Scenario.Metrics;
        var users = Scenario.Users;

        await SeedPostgresAsync(exposures, metrics, users);
        await SeedMongoAsync(exposures, metrics, users);
        await SeedClickHouseAsync(exposures, metrics, users);
        await ValidateClickHouseSeedAsync(
            exposures.Length,
            metrics.Length,
            exposures.Count(x => x.FlagKey == FlagKey));
    }

    public async Task SeedUnbalancedVariantScenarioAsync()
    {
        await ClearAsync();

        var createdAt = DateTimeOffset.Parse("2026-01-01T00:00:00Z");
        var exposures = new List<ScenarioExposure>();
        var metrics = new List<ScenarioMetric>();
        var users = new List<ScenarioUser>();
        var sequence = 1;
        var metricSequence = 1;

        AddUsers("control", "control", count: 900);
        AddUsers("treatment", "treatment", count: 100);

        await SeedPostgresAsync(exposures, metrics, users);
        await SeedMongoAsync(exposures, metrics, users);
        await SeedClickHouseAsync(exposures, metrics, users);
        await ValidateClickHouseSeedAsync(exposures.Count, metrics.Count, exposures.Count);
        return;

        void AddUsers(string prefix, string variationId, int count)
        {
            for (var i = 1; i <= count; i++)
            {
                var userKey = $"{prefix}-{i:000}";
                var exposedAt = DateTimeOffset.Parse("2026-01-01T01:00:00Z").AddSeconds(sequence);
                users.Add(new ScenarioUser(EnvId, userKey, userKey));
                exposures.Add(new ScenarioExposure(
                    GuidFromSequence(sequence++),
                    EnvId,
                    FlagKey,
                    userKey,
                    variationId,
                    variationId,
                    exposedAt,
                    createdAt));
                metrics.Add(new ScenarioMetric(
                    MetricGuidFromSequence(metricSequence++),
                    EnvId,
                    userKey,
                    MetricEvent,
                    "CustomEvent",
                    1,
                    exposedAt.AddMinutes(1),
                    createdAt));
            }
        }
    }

    public async Task SeedSamplingPlanScenarioAsync(Guid runId)
    {
        await ClearAsync();

        var createdAt = DateTimeOffset.Parse("2026-01-01T00:00:00Z");
        var exposures = new List<ScenarioExposure>();
        var metrics = new List<ScenarioMetric>();
        var users = new List<ScenarioUser>();
        var sequence = 1;
        var metricSequence = 1;
        var sampledControl = 0;
        var sampledTreatment = 0;
        var excludedControl = 0;
        var candidate = 1;
        var samplingScope = runId.ToString("N") + ":";

        while (sampledControl < 80 || sampledTreatment < 80 || excludedControl < 100)
        {
            var userKey = $"sampling-{candidate++:000000}";
            var controlBucket = DispatchAlgorithm.RolloutOfKey($"{samplingScope}control:{userKey}") * 100;

            if (controlBucket < 11.111111 && sampledControl < 80)
            {
                AddUser(userKey, "control", duplicateExposure: sampledControl < 5);
                sampledControl++;
            }
            else if (sampledTreatment < 80)
            {
                AddUser(userKey, "treatment", duplicateExposure: sampledTreatment < 5);
                sampledTreatment++;
            }
            else if (controlBucket >= 11.111111 && excludedControl < 100)
            {
                AddUser(userKey, "control");
                excludedControl++;
            }
        }

        await SeedPostgresAsync(exposures, metrics, users);
        await SeedMongoAsync(exposures, metrics, users);
        await SeedClickHouseAsync(exposures, metrics, users);
        await ValidateClickHouseSeedAsync(exposures.Count, metrics.Count, exposures.Count);
        return;

        void AddUser(string userKey, string variationId, bool duplicateExposure = false)
        {
            var exposedAt = DateTimeOffset.Parse("2026-01-01T01:00:00Z").AddSeconds(sequence);
            users.Add(new ScenarioUser(EnvId, userKey, userKey));

            exposures.Add(new ScenarioExposure(
                GuidFromSequence(sequence++),
                EnvId,
                FlagKey,
                userKey,
                variationId,
                variationId,
                exposedAt,
                createdAt));
            if (duplicateExposure)
            {
                exposures.Add(new ScenarioExposure(
                    GuidFromSequence(sequence++),
                    EnvId,
                    FlagKey,
                    userKey,
                    variationId,
                    variationId,
                    exposedAt.AddMilliseconds(1),
                    createdAt));
            }
            metrics.Add(new ScenarioMetric(
                MetricGuidFromSequence(metricSequence++),
                EnvId,
                userKey,
                MetricEvent,
                "CustomEvent",
                1,
                exposedAt.AddMinutes(-1),
                createdAt));
            metrics.Add(new ScenarioMetric(
                MetricGuidFromSequence(metricSequence++),
                EnvId,
                userKey,
                MetricEvent,
                "CustomEvent",
                1,
                exposedAt.AddMinutes(1),
                createdAt));
            metrics.Add(new ScenarioMetric(
                MetricGuidFromSequence(metricSequence++),
                EnvId,
                userKey,
                MetricEvent,
                "CustomEvent",
                1,
                exposedAt.AddMinutes(2),
                createdAt));
        }
    }

    public (string Name, IExperimentStatsService Service)[] CreateExperimentStatsServices()
    {
        return
        [
            ("Postgres", new global::Infrastructure.Services.EntityFrameworkCore.ReleaseDecisionExperimentStatsService(CreateDbContext())),
            ("MongoDb", new global::Infrastructure.Services.MongoDb.ReleaseDecisionExperimentStatsService(CreateMongoDbClient())),
            ("ClickHouse", new global::Infrastructure.Services.ClickHouse.ReleaseDecisionExperimentStatsService(CreateClickHouseClient()))
        ];
    }

    public (string Name, IFeatureFlagInsightsService Service)[] CreateFeatureFlagInsightsServices()
    {
        return
        [
            ("Postgres", new global::Infrastructure.Services.EntityFrameworkCore.ReleaseDecisionFeatureFlagInsightsService(CreateDbContext())),
            ("MongoDb", new global::Infrastructure.Services.MongoDb.ReleaseDecisionFeatureFlagInsightsService(CreateMongoDbClient())),
            ("ClickHouse", new global::Infrastructure.Services.ClickHouse.ReleaseDecisionFeatureFlagInsightsService(CreateClickHouseClient()))
        ];
    }

    public (string Name, IFeatureFlagEndUserStatsService Service)[] CreateFeatureFlagEndUserStatsServices()
    {
        return
        [
            ("Postgres", new global::Infrastructure.Services.EntityFrameworkCore.ReleaseDecisionFeatureFlagEndUserStatsService(CreateDbContext())),
            ("MongoDb", new global::Infrastructure.Services.MongoDb.ReleaseDecisionFeatureFlagEndUserStatsService(CreateMongoDbClient())),
            ("ClickHouse", new global::Infrastructure.Services.ClickHouse.ReleaseDecisionFeatureFlagEndUserStatsService(CreateClickHouseClient()))
        ];
    }

    private AppDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(PostgresConnectionString)
            .UseSnakeCaseNamingConvention()
            .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking)
            .Options;

        return new AppDbContext(options);
    }

    private MongoDbClient CreateMongoDbClient()
    {
        return new MongoDbClient(Options.Create(new MongoDbOptions
        {
            ConnectionString = MongoConnectionString,
            Database = "featbit"
        }));
    }

    private ClickHouseClient CreateClickHouseClient(string database = "featbit")
    {
        return new ClickHouseClient(new HttpClient(), Options.Create(new ClickHouseOptions
        {
            HttpEndpoint = ClickHouseHttpEndpoint,
            Database = database,
            User = "default"
        }));
    }

    private string PostgresConnectionString =>
        $"Host=localhost;Port={_postgres.GetMappedPublicPort(5432)};Username=postgres;Password=please_change_me;Database=featbit";

    private string MongoConnectionString =>
        $"mongodb://admin:password@localhost:{_mongo.GetMappedPublicPort(27017)}";

    private string ClickHouseHttpEndpoint =>
        $"http://localhost:{_clickHouse.GetMappedPublicPort(8123)}";

    private async Task InitializePostgresAsync()
    {
        await using var connection = new NpgsqlConnection(PostgresConnectionString);
        await connection.ExecuteAsync("""
            CREATE TABLE IF NOT EXISTS release_decision_exposure_events
            (
                id uuid primary key default gen_random_uuid(),
                env_id uuid not null,
                flag_key varchar(256) not null,
                user_key varchar(512) not null,
                variation_id varchar(256) not null,
                variation_value varchar(512) null,
                exposed_at timestamp with time zone not null,
                properties jsonb null,
                created_at timestamp with time zone not null
            );

            CREATE TABLE IF NOT EXISTS release_decision_metric_events
            (
                id uuid primary key,
                env_id uuid not null,
                user_key varchar(512) not null,
                event_name varchar(256) not null,
                event_type varchar(64) not null,
                numeric_value double precision not null,
                occurred_at timestamp with time zone not null,
                properties jsonb null,
                created_at timestamp with time zone not null
            );

            CREATE TABLE IF NOT EXISTS end_users
            (
                env_id uuid null,
                key_id varchar(512) not null,
                name varchar(256) not null
            );

            CREATE TABLE IF NOT EXISTS release_decision_run_assignments
            (
                id uuid primary key,
                run_id uuid not null,
                env_id uuid not null,
                flag_key varchar(256) not null,
                allocation_key varchar(512) not null,
                assignment_unit varchar(512) not null,
                user_key varchar(512) not null,
                expected_variation_id varchar(256) not null,
                actual_variation_id varchar(256) not null,
                role varchar(64) not null,
                analysis_role varchar(64) not null,
                bucket double precision not null,
                layer_bucket double precision null,
                sampling_bucket double precision null,
                included_by_sampling boolean not null default true,
                exclusion_reason varchar(64) null,
                assigned_at timestamp with time zone not null,
                first_exposed_at timestamp with time zone null,
                created_at timestamp with time zone not null,
                updated_at timestamp with time zone not null
            );

            CREATE UNIQUE INDEX IF NOT EXISTS ix_release_decision_run_assignments_run_allocation
                ON release_decision_run_assignments (run_id, allocation_key);

            CREATE UNIQUE INDEX IF NOT EXISTS ix_release_decision_run_assignments_run_assignment_unit
                ON release_decision_run_assignments (run_id, assignment_unit);
            """);
    }

    private async Task InitializeClickHouseAsync()
    {
        var defaultClient = CreateClickHouseClient("default");
        await defaultClient.ExecuteCommandAsync("CREATE DATABASE IF NOT EXISTS featbit");

        var client = CreateClickHouseClient();
        await client.ExecuteCommandAsync("""
            CREATE TABLE IF NOT EXISTS release_decision_exposure_events
            (
                id UUID,
                env_id UUID,
                flag_key LowCardinality(String),
                user_key String,
                user_name String,
                variation_id LowCardinality(String),
                variation_value String,
                exposed_at DateTime64(6, 'UTC'),
                properties String,
                created_at DateTime64(6, 'UTC') DEFAULT now64(6)
            )
            ENGINE = MergeTree
            PARTITION BY (env_id, toYYYYMM(exposed_at))
            ORDER BY (env_id, flag_key, exposed_at, cityHash64(user_key))
            SETTINGS index_granularity = 8192
            """);

        await client.ExecuteCommandAsync("""
            CREATE TABLE IF NOT EXISTS release_decision_metric_events
            (
                id UUID,
                env_id UUID,
                user_key String,
                user_name String,
                event_name LowCardinality(String),
                event_type LowCardinality(String),
                numeric_value Float64,
                occurred_at DateTime64(6, 'UTC'),
                properties String,
                created_at DateTime64(6, 'UTC') DEFAULT now64(6)
            )
            ENGINE = MergeTree
            PARTITION BY (env_id, toYYYYMM(occurred_at))
            ORDER BY (env_id, event_name, occurred_at, cityHash64(user_key))
            SETTINGS index_granularity = 8192
            """);
    }

    private async Task ClearAsync()
    {
        await using (var connection = new NpgsqlConnection(PostgresConnectionString))
        {
            await connection.ExecuteAsync("""
                TRUNCATE TABLE release_decision_exposure_events;
                TRUNCATE TABLE release_decision_metric_events;
                TRUNCATE TABLE end_users;
                TRUNCATE TABLE release_decision_run_assignments;
                """);
        }

        var mongo = CreateMongoDbClient();
        await mongo.CollectionOf<ReleaseDecisionExposureEvent>().DeleteManyAsync(_ => true);
        await mongo.CollectionOf<ReleaseDecisionMetricEvent>().DeleteManyAsync(_ => true);
        await mongo.CollectionOf<EndUser>().DeleteManyAsync(_ => true);

        var clickHouse = CreateClickHouseClient();
        await clickHouse.ExecuteCommandAsync("TRUNCATE TABLE release_decision_exposure_events");
        await clickHouse.ExecuteCommandAsync("TRUNCATE TABLE release_decision_metric_events");
    }

    private async Task SeedPostgresAsync(
        IEnumerable<ScenarioExposure> exposures,
        IEnumerable<ScenarioMetric> metrics,
        IEnumerable<ScenarioUser> users)
    {
        await using var connection = new NpgsqlConnection(PostgresConnectionString);

        await connection.ExecuteAsync("""
            INSERT INTO release_decision_exposure_events
                (id, env_id, flag_key, user_key, variation_id, variation_value, exposed_at, properties, created_at)
            VALUES
                (@Id, @EnvId, @FlagKey, @UserKey, @VariationId, @VariationValue, @ExposedAt, @Properties::jsonb, @CreatedAt)
            """, exposures);

        await connection.ExecuteAsync("""
            INSERT INTO release_decision_metric_events
                (id, env_id, user_key, event_name, event_type, numeric_value, occurred_at, properties, created_at)
            VALUES
                (@Id, @EnvId, @UserKey, @EventName, @EventType, @NumericValue, @OccurredAt, @Properties::jsonb, @CreatedAt)
            """, metrics);

        await connection.ExecuteAsync("""
            INSERT INTO end_users (env_id, key_id, name)
            VALUES (@EnvId, @KeyId, @Name)
            """, users);
    }

    private async Task SeedMongoAsync(
        IEnumerable<ScenarioExposure> exposures,
        IEnumerable<ScenarioMetric> metrics,
        IEnumerable<ScenarioUser> users)
    {
        var mongo = CreateMongoDbClient();

        await mongo.CollectionOf<ReleaseDecisionExposureEvent>().InsertManyAsync(exposures.Select(x =>
            new ReleaseDecisionExposureEvent
            {
                Id = x.Id,
                EnvId = x.EnvId,
                FlagKey = x.FlagKey,
                UserKey = x.UserKey,
                VariationId = x.VariationId,
                VariationValue = x.VariationValue,
                ExposedAt = x.ExposedAt.UtcDateTime,
                Properties = x.Properties,
                CreatedAt = x.CreatedAt.UtcDateTime
            }));

        await mongo.CollectionOf<ReleaseDecisionMetricEvent>().InsertManyAsync(metrics.Select(x =>
            new ReleaseDecisionMetricEvent
            {
                Id = x.Id,
                EnvId = x.EnvId,
                UserKey = x.UserKey,
                EventName = x.EventName,
                EventType = x.EventType,
                NumericValue = x.NumericValue,
                OccurredAt = x.OccurredAt.UtcDateTime,
                Properties = x.Properties,
                CreatedAt = x.CreatedAt.UtcDateTime
            }));

        await mongo.CollectionOf<EndUser>().InsertManyAsync(users.Select(x =>
            new EndUser(null, x.EnvId, x.KeyId, x.Name, [])
            {
                Id = Guid.NewGuid()
            }));
    }

    private async Task SeedClickHouseAsync(
        IEnumerable<ScenarioExposure> exposures,
        IEnumerable<ScenarioMetric> metrics,
        IEnumerable<ScenarioUser> users)
    {
        var userNames = users.ToDictionary(x => x.KeyId, x => x.Name);
        var clickHouse = CreateClickHouseClient();

        foreach (var chunk in exposures.Chunk(500))
        {
            var values = chunk.Select(exposure =>
            {
                var userName = userNames.GetValueOrDefault(exposure.UserKey, exposure.UserKey);
                return $"""
                    ({ChUuid(exposure.Id)},
                     {ChUuid(exposure.EnvId)},
                     {ChString(exposure.FlagKey)},
                     {ChString(exposure.UserKey)},
                     {ChString(userName)},
                     {ChString(exposure.VariationId)},
                     {ChString(exposure.VariationValue)},
                     {ChDateTime64(exposure.ExposedAt)},
                     {ChString(exposure.Properties)},
                     {ChDateTime64(exposure.CreatedAt)})
                    """;
            });

            await clickHouse.ExecuteCommandAsync($"""
                INSERT INTO release_decision_exposure_events
                    (id, env_id, flag_key, user_key, user_name, variation_id, variation_value, exposed_at, properties, created_at)
                VALUES
                    {string.Join(",\n", values)}
                """);
        }

        foreach (var chunk in metrics.Chunk(500))
        {
            var values = chunk.Select(metric =>
            {
                var userName = userNames.GetValueOrDefault(metric.UserKey, metric.UserKey);
                return $"""
                    ({ChUuid(metric.Id)},
                     {ChUuid(metric.EnvId)},
                     {ChString(metric.UserKey)},
                     {ChString(userName)},
                     {ChString(metric.EventName)},
                     {ChString(metric.EventType)},
                     {metric.NumericValue.ToString(System.Globalization.CultureInfo.InvariantCulture)},
                     {ChDateTime64(metric.OccurredAt)},
                     {ChString(metric.Properties)},
                     {ChDateTime64(metric.CreatedAt)})
                    """;
            });

            await clickHouse.ExecuteCommandAsync($"""
                INSERT INTO release_decision_metric_events
                    (id, env_id, user_key, user_name, event_name, event_type, numeric_value, occurred_at, properties, created_at)
                VALUES
                    {string.Join(",\n", values)}
                """);
        }
    }

    private async Task ValidateClickHouseSeedAsync(
        int expectedExposures,
        int expectedMetrics,
        int expectedFlagExposures)
    {
        var clickHouse = CreateClickHouseClient();
        var exposureCount = await clickHouse.QueryAsync<CountRow>(
            "SELECT toInt32(count()) AS Count FROM release_decision_exposure_events");
        var metricCount = await clickHouse.QueryAsync<CountRow>(
            "SELECT toInt32(count()) AS Count FROM release_decision_metric_events");
        var envFlagExposureCount = await clickHouse.QueryAsync<CountRow>($"""
            SELECT toInt32(count()) AS Count
            FROM release_decision_exposure_events
            WHERE env_id = {ChUuid(EnvId)}
              AND flag_key = {ChString(FlagKey)}
            """);
        var filteredExposureCount = await clickHouse.QueryAsync<CountRow>($"""
            SELECT toInt32(count()) AS Count
            FROM release_decision_exposure_events
            WHERE env_id = {ChUuid(EnvId)}
              AND flag_key = {ChString(FlagKey)}
              AND exposed_at >= {ChDateTime64(DateTimeOffset.Parse("2026-01-01T00:00:00Z"))}
              AND exposed_at < {ChDateTime64(DateTimeOffset.Parse("2026-01-03T00:00:00Z"))}
            """);

        if (exposureCount.Single().Count != expectedExposures || metricCount.Single().Count != expectedMetrics)
        {
            throw new InvalidOperationException(
                $"ClickHouse seed failed. Expected {expectedExposures} exposures and {expectedMetrics} metrics, " +
                $"actual {exposureCount.Single().Count} exposures and {metricCount.Single().Count} metrics.");
        }

        if (filteredExposureCount.Single().Count != expectedFlagExposures)
        {
            var sample = await clickHouse.QueryAsync<ExposureSampleRow>("""
                SELECT
                    toString(env_id) AS EnvId,
                    flag_key AS FlagKey,
                    toString(exposed_at) AS ExposedAt,
                    toUnixTimestamp64Milli(exposed_at) AS ExposedAtMs
                FROM release_decision_exposure_events
                LIMIT 1
                """);
            throw new InvalidOperationException(
                $"ClickHouse filtered seed check failed. Expected {expectedFlagExposures} " +
                $"matching exposures, actual {filteredExposureCount.Single().Count}. " +
                $"Env/flag count {envFlagExposureCount.Single().Count}. " +
                $"Sample: {sample.SingleOrDefault()?.EnvId}, {sample.SingleOrDefault()?.FlagKey}, " +
                $"{sample.SingleOrDefault()?.ExposedAt}, {sample.SingleOrDefault()?.ExposedAtMs}.");
        }
    }

    private static Guid GuidFromSequence(int sequence) =>
        Guid.Parse($"00000000-0000-0000-0000-{sequence:000000000000}");

    private static Guid MetricGuidFromSequence(int sequence) =>
        Guid.Parse($"10000000-0000-0000-0000-{sequence:000000000000}");

    private static string ChString(string value)
    {
        return $"'{value.Replace("\\", "\\\\").Replace("'", "\\'")}'";
    }

    private static string ChUuid(Guid value)
    {
        return $"toUUID('{value}')";
    }

    private static string ChDateTime64(DateTimeOffset value)
    {
        return $"toDateTime64('{value.UtcDateTime:yyyy-MM-dd HH:mm:ss.ffffff}', 6, 'UTC')";
    }

    private static class Scenario
    {
        private static readonly DateTimeOffset CreatedAt = DateTimeOffset.Parse("2026-01-01T00:00:00Z");
        private const int SampleSizePerVariant = 500;

        public static readonly ScenarioUser[] Users = BuildUsers();
        public static readonly ScenarioExposure[] Exposures = BuildExposures();
        public static readonly ScenarioMetric[] Metrics = BuildMetrics();

        private static ScenarioUser[] BuildUsers()
        {
            var users = new List<ScenarioUser>();
            foreach (var prefix in new[] { "a", "b", "c" })
            {
                for (var i = 1; i <= SampleSizePerVariant; i++)
                {
                    users.Add(new ScenarioUser(EnvId, UserKey(prefix, i), $"{prefix.ToUpperInvariant()} User {i:000}"));
                }
            }

            users.Add(new ScenarioUser(EnvId, "other-flag-user", "Other Flag User"));
            return users.ToArray();
        }

        private static ScenarioExposure[] BuildExposures()
        {
            var sequence = 1;
            var exposures = new List<ScenarioExposure>();
            AddVariantExposures(exposures, ref sequence, "a", "A", "control");
            AddVariantExposures(exposures, ref sequence, "b", "B", "treatment");
            AddVariantExposures(exposures, ref sequence, "c", "C", "candidate");
            exposures.Add(new ScenarioExposure(
                GuidFromSequence(900001),
                EnvId,
                "other-flag",
                "other-flag-user",
                "A",
                "control",
                DateTimeOffset.Parse("2026-01-01T01:00:00Z"),
                CreatedAt));

            return exposures.ToArray();
        }

        private static ScenarioMetric[] BuildMetrics()
        {
            var sequence = 1;
            var metrics = new List<ScenarioMetric>();

            AddNoiseMetrics(metrics, ref sequence, "a", 1);
            AddNoiseMetrics(metrics, ref sequence, "b", 1);
            AddNoiseMetrics(metrics, ref sequence, "c", 1);

            for (var i = 1; i <= 250; i++)
            {
                AddMetric(metrics, ref sequence, UserKey("a", i), MetricEvent, 10, ExposureAt(i).AddMinutes(10));
                AddMetric(metrics, ref sequence, UserKey("a", i), MetricEvent, 20, ExposureAt(i).AddMinutes(20));
            }

            for (var i = 1; i <= 300; i++)
            {
                AddMetric(metrics, ref sequence, UserKey("b", i), MetricEvent, 25, ExposureAt(i).AddMinutes(10));
            }

            for (var i = 1; i <= 200; i++)
            {
                AddMetric(metrics, ref sequence, UserKey("c", i), MetricEvent, 1, ExposureAt(i).AddMinutes(10));
                AddMetric(metrics, ref sequence, UserKey("c", i), MetricEvent, 2, ExposureAt(i).AddMinutes(20));
                AddMetric(metrics, ref sequence, UserKey("c", i), MetricEvent, 3, ExposureAt(i).AddMinutes(30));
            }

            return metrics.ToArray();
        }

        private static void AddVariantExposures(
            ICollection<ScenarioExposure> exposures,
            ref int sequence,
            string userPrefix,
            string variationId,
            string variationValue)
        {
            for (var i = 1; i <= SampleSizePerVariant; i++)
            {
                exposures.Add(new ScenarioExposure(
                    GuidFromSequence(sequence++),
                    EnvId,
                    FlagKey,
                    UserKey(userPrefix, i),
                    variationId,
                    variationValue,
                    ExposureAt(i),
                    CreatedAt));
            }
        }

        private static void AddNoiseMetrics(
            ICollection<ScenarioMetric> metrics,
            ref int sequence,
            string userPrefix,
            int userNumber)
        {
            var userKey = UserKey(userPrefix, userNumber);
            var exposedAt = ExposureAt(userNumber);
            AddMetric(metrics, ref sequence, userKey, MetricEvent, 99, exposedAt.AddMinutes(-10));
            AddMetric(metrics, ref sequence, userKey, "refund", 1, exposedAt.AddMinutes(10));
        }

        private static void AddMetric(
            ICollection<ScenarioMetric> metrics,
            ref int sequence,
            string userKey,
            string eventName,
            double numericValue,
            DateTimeOffset occurredAt)
        {
            metrics.Add(new ScenarioMetric(
                MetricGuidFromSequence(sequence++),
                EnvId,
                userKey,
                eventName,
                "CustomEvent",
                numericValue,
                occurredAt,
                CreatedAt));
        }

        private static DateTimeOffset ExposureAt(int userNumber)
        {
            var dayStart = userNumber <= 250
                ? DateTimeOffset.Parse("2026-01-01T01:00:00Z")
                : DateTimeOffset.Parse("2026-01-02T01:00:00Z");
            var indexInDay = (userNumber - 1) % 250;

            return dayStart.AddMinutes(indexInDay);
        }

        private static string UserKey(string prefix, int number) => $"{prefix}-{number:000}";

        private static Guid GuidFromSequence(int sequence) =>
            Guid.Parse($"00000000-0000-0000-0000-{sequence:000000000000}");

        private static Guid MetricGuidFromSequence(int sequence) =>
            Guid.Parse($"10000000-0000-0000-0000-{sequence:000000000000}");
    }

    private sealed class CountRow
    {
        public int Count { get; init; }
    }

    private sealed class ExposureSampleRow
    {
        public string EnvId { get; init; } = string.Empty;
        public string FlagKey { get; init; } = string.Empty;
        public string ExposedAt { get; init; } = string.Empty;
        public long ExposedAtMs { get; init; }
    }
}

public sealed record ScenarioUser(Guid EnvId, string KeyId, string Name);

public sealed record ScenarioExposure(
    Guid Id,
    Guid EnvId,
    string FlagKey,
    string UserKey,
    string VariationId,
    string VariationValue,
    DateTimeOffset ExposedAt,
    DateTimeOffset CreatedAt,
    string Properties = "{}");

public sealed record ScenarioMetric(
    Guid Id,
    Guid EnvId,
    string UserKey,
    string EventName,
    string EventType,
    double NumericValue,
    DateTimeOffset OccurredAt,
    DateTimeOffset CreatedAt,
    string Properties = "{}");
