using Aspire.Hosting;
using Aspire.Hosting.ApplicationModel;
using Microsoft.Extensions.Configuration;

var builder = DistributedApplication.CreateBuilder(args);

var topology = builder.Configuration.GetValue("FeatBit:Topology", LocalTopology.Standalone);
var useExistingInfrastructure = builder.Configuration.GetValue("FeatBit:UseExistingInfrastructure", false);
var includeUi = builder.Configuration.GetValue("FeatBit:IncludeUi", true);
var includeEvaluationServer = builder.Configuration.GetValue("FeatBit:IncludeEvaluationServer", false);
var includeReleaseDecisionWeb = builder.Configuration.GetValue("FeatBit:IncludeReleaseDecisionWeb", true);

var (dbProvider, mqProvider, cacheProvider, olapProvider) = topology switch
{
    LocalTopology.Standalone => ("Postgres", "Postgres", "None", "None"),
    LocalTopology.StandardPostgres => ("Postgres", "Redis", "Redis", "None"),
    LocalTopology.StandardMongoDb => ("MongoDb", "Redis", "Redis", "None"),
    LocalTopology.ProPostgres => ("Postgres", "Kafka", "Redis", "ClickHouse"),
    LocalTopology.ProMongoDb => ("MongoDb", "Kafka", "Redis", "ClickHouse"),
    _ => throw new NotSupportedException($"Unsupported local topology: {topology}")
};

var useRedis = IsProvider(mqProvider, "Redis") || IsProvider(cacheProvider, "Redis");
var useClickHouseOlap = IsProvider(olapProvider, "ClickHouse");

ValidateLocalTopology();

const string postgresConnectionString =
    "Host=localhost;Port=5432;Username=postgres;Password=please_change_me;Database=featbit";
const string mongoDbConnectionString = "mongodb://admin:password@localhost:27017";
const string redisConnectionString = "localhost:6379";
const string kafkaBootstrapServers = "localhost:29092";
const string clickHouseHttpEndpoint = "http://localhost:8123";

IResourceBuilder<ContainerResource>? mainDb = null;
IResourceBuilder<ContainerResource>? redis = null;
IResourceBuilder<ContainerResource>? kafka = null;
IResourceBuilder<ContainerResource>? clickHouse = null;
IResourceBuilder<ConnectionStringResource>? externalPostgres = null;
IResourceBuilder<ConnectionStringResource>? externalRedis = null;

if (useExistingInfrastructure)
{
    var postgresConnection = builder.AddParameterFromConfiguration(
        "postgresql-connection",
        "ConnectionStrings:postgresql",
        secret: true);
    var redisConnection = builder.AddParameterFromConfiguration(
        "redis-connection",
        "ConnectionStrings:redis");

    externalPostgres = builder.AddConnectionString(
        "postgresql",
        ReferenceExpression.Create($"{postgresConnection}"));
    externalRedis = builder.AddConnectionString(
        "redis",
        ReferenceExpression.Create($"{redisConnection}"));
}

if (!useExistingInfrastructure && IsProvider(dbProvider, "Postgres"))
{
    mainDb = builder
        .AddContainer("postgresql", "postgres", "15.10")
        .WithEnvironment("POSTGRES_USER", "postgres")
        .WithEnvironment("POSTGRES_PASSWORD", "please_change_me")
        .WithEnvironment("PGDATA", "/var/lib/postgresql/data/pgdata")
        .WithBindMount("postgres-init", "/docker-entrypoint-initdb.d", isReadOnly: true)
        .WithBindMount("../infra/postgresql/docker-entrypoint-initdb.d", "/featbit-init/released", isReadOnly: true)
        .WithBindMount("../modules/back-end/tests/Infrastructure.IntegrationTests/Fixtures", "/featbit-init/pending", isReadOnly: true)
        .WithEndpoint(port: 5432, targetPort: 5432, name: "tcp", isProxied: false)
        .WithVolume("featbit-aspire-postgres-vnext", "/var/lib/postgresql/data");
}
else if (!useExistingInfrastructure && IsProvider(dbProvider, "MongoDb"))
{
    mainDb = builder
        .AddContainer("mongodb", "mongo", "5.0.32")
        .WithEnvironment("MONGO_INITDB_ROOT_USERNAME", "admin")
        .WithEnvironment("MONGO_INITDB_ROOT_PASSWORD", "password")
        .WithEnvironment("MONGO_INITDB_DATABASE", "featbit")
        .WithBindMount("../infra/mongodb/docker-entrypoint-initdb.d", "/docker-entrypoint-initdb.d", isReadOnly: true)
        .WithEndpoint(port: 27017, targetPort: 27017, name: "tcp", isProxied: false)
        .WithVolume("featbit-aspire-mongodb", "/data/db");
}

if (!useExistingInfrastructure && useRedis)
{
    redis = builder
        .AddContainer("redis", "bitnamilegacy/redis", "6.2.10")
        .WithEnvironment("ALLOW_EMPTY_PASSWORD", "yes")
        .WithEndpoint(port: 6379, targetPort: 6379, name: "tcp", isProxied: false)
        .WithVolume("featbit-aspire-redis", "/bitnami/redis/data");
}

if (!useExistingInfrastructure && useClickHouseOlap)
{
    kafka = builder
        .AddContainer("kafka", "bitnamilegacy/kafka", "3.5")
        .WithEnvironment("KAFKA_CFG_NODE_ID", "0")
        .WithEnvironment("KAFKA_CFG_PROCESS_ROLES", "controller,broker")
        .WithEnvironment("KAFKA_CFG_CONTROLLER_QUORUM_VOTERS", "0@kafka:9093")
        .WithEnvironment("KAFKA_CFG_LISTENER_SECURITY_PROTOCOL_MAP", "PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT,CONTROLLER:PLAINTEXT")
        .WithEnvironment("KAFKA_CFG_LISTENERS", "PLAINTEXT://:9092,PLAINTEXT_HOST://:29092,CONTROLLER://:9093")
        .WithEnvironment("KAFKA_CFG_ADVERTISED_LISTENERS", "PLAINTEXT://kafka:9092,PLAINTEXT_HOST://localhost:29092")
        .WithEnvironment("KAFKA_CFG_CONTROLLER_LISTENER_NAMES", "CONTROLLER")
        .WithEnvironment("KAFKA_CFG_AUTO_CREATE_TOPICS_ENABLE", "true")
        .WithEnvironment("ALLOW_PLAINTEXT_LISTENER", "true")
        .WithEndpoint(targetPort: 9092, name: "broker")
        .WithEndpoint(port: 29092, targetPort: 29092, name: "host", isProxied: false)
        .WithVolume("featbit-aspire-kafka", "/bitnami/kafka");

    clickHouse = builder
        .AddContainer("clickhouse-server", "clickhouse/clickhouse-server", "23.7")
        .WithBindMount("../infra/clickhouse/docker-entrypoint-initdb.d", "/docker-entrypoint-initdb.d", isReadOnly: true)
        .WithBindMount("../infra/clickhouse/single_node/config.xml", "/etc/clickhouse-server/config.xml", isReadOnly: true)
        .WithBindMount("../infra/clickhouse/users.xml", "/etc/clickhouse-server/users.xml", isReadOnly: true)
        .WithEndpoint(port: 8123, targetPort: 8123, name: "http", isProxied: false)
        .WithEndpoint(port: 9000, targetPort: 9000, name: "tcp", isProxied: false)
        .WithVolume("featbit-aspire-clickhouse", "/var/lib/clickhouse")
        .WaitFor(kafka!);
}

var apiServer = builder
    .AddProject<BackendApiProject>("api-server")
    .WithHttpEndpoint(port: 5000, targetPort: 5000, isProxied: false)
    .WithHttpsEndpoint(port: 5001, targetPort: 5001, isProxied: false)
    .WithEnvironment("ASPNETCORE_ENVIRONMENT", "Development")
    .WithEnvironment("ASPNETCORE_URLS", "http://localhost:5000;https://localhost:5001")
    .WithEnvironment("DbProvider", dbProvider)
    .WithEnvironment("MqProvider", mqProvider)
    .WithEnvironment("CacheProvider", cacheProvider)
    .WithEnvironment("Jwt__Algorithm", "HS256")
    .WithEnvironment("Jwt__Key", "please_change_me_to_a_secure_secret_key")
    .WithHttpHealthCheck("/health/readiness", endpointName: "http");

if (useExistingInfrastructure)
{
    apiServer = apiServer
        .WithReference(externalPostgres!)
        .WithReference(externalRedis!)
        .WithEnvironment("Postgres__ConnectionString", externalPostgres!.Resource.ConnectionStringExpression)
        .WithEnvironment("Redis__ConnectionString", externalRedis!.Resource.ConnectionStringExpression)
        .WaitFor(externalPostgres!)
        .WaitFor(externalRedis!);
}
else
{
    apiServer = apiServer.WaitFor(mainDb!);
}

if (!useExistingInfrastructure && IsProvider(dbProvider, "Postgres"))
{
    apiServer = apiServer.WithEnvironment("Postgres__ConnectionString", postgresConnectionString);
}

if (!useExistingInfrastructure && IsProvider(dbProvider, "MongoDb"))
{
    apiServer = apiServer
        .WithEnvironment("MongoDb__ConnectionString", mongoDbConnectionString)
        .WithEnvironment("MongoDb__Database", "featbit");
}

if (!useExistingInfrastructure && useRedis)
{
    apiServer = apiServer
        .WithEnvironment("Redis__ConnectionString", redisConnectionString)
        .WaitFor(redis!);
}

if (!useExistingInfrastructure && useClickHouseOlap)
{
    apiServer = apiServer
        .WithEnvironment("OLAPProvider", olapProvider)
        .WithEnvironment("ClickHouse__HttpEndpoint", clickHouseHttpEndpoint)
        .WithEnvironment("ClickHouse__Database", "featbit")
        .WithEnvironment("ClickHouse__User", "default")
        .WithEnvironment("Kafka__Producer__bootstrap.servers", kafkaBootstrapServers)
        .WithEnvironment("Kafka__Consumer__bootstrap.servers", kafkaBootstrapServers)
        .WaitFor(clickHouse!)
        .WaitFor(kafka!);
}

ConfigureFeatBitOpenTelemetry(apiServer, "featbit-api");

IResourceBuilder<ProjectResource>? evaluationServer = null;

if (includeEvaluationServer)
{
    evaluationServer = builder
        .AddProject<EvaluationApiProject>("evaluation-server")
        .WithHttpEndpoint(port: 5100, targetPort: 5100, isProxied: false)
        .WithHttpsEndpoint(port: 5101, targetPort: 5101, isProxied: false)
        .WithEnvironment("ASPNETCORE_ENVIRONMENT", "Development")
        .WithEnvironment("ASPNETCORE_URLS", "http://localhost:5100;https://localhost:5101")
        .WithEnvironment("DbProvider", dbProvider)
        .WithEnvironment("MqProvider", mqProvider)
        .WithEnvironment("CacheProvider", cacheProvider)
        .WithHttpHealthCheck("/health/readiness", endpointName: "http");

    if (useExistingInfrastructure)
    {
        evaluationServer = evaluationServer
            .WithReference(externalPostgres!)
            .WithReference(externalRedis!)
            .WithEnvironment("Postgres__ConnectionString", externalPostgres!.Resource.ConnectionStringExpression)
            .WithEnvironment("Redis__ConnectionString", externalRedis!.Resource.ConnectionStringExpression)
            .WaitFor(externalPostgres!)
            .WaitFor(externalRedis!);
    }
    else
    {
        evaluationServer = evaluationServer.WaitFor(mainDb!);
    }

    if (!useExistingInfrastructure && IsProvider(dbProvider, "Postgres"))
    {
        evaluationServer = evaluationServer.WithEnvironment("Postgres__ConnectionString", postgresConnectionString);
    }

    if (!useExistingInfrastructure && IsProvider(dbProvider, "MongoDb"))
    {
        evaluationServer = evaluationServer
            .WithEnvironment("MongoDb__ConnectionString", mongoDbConnectionString)
            .WithEnvironment("MongoDb__Database", "featbit");
    }

    if (!useExistingInfrastructure && useRedis)
    {
        evaluationServer = evaluationServer
            .WithEnvironment("Redis__ConnectionString", redisConnectionString)
            .WaitFor(redis!);
    }

    if (!useExistingInfrastructure && useClickHouseOlap)
    {
        evaluationServer = evaluationServer
            .WithEnvironment("Kafka__Producer__bootstrap.servers", kafkaBootstrapServers)
            .WithEnvironment("Kafka__Consumer__bootstrap.servers", kafkaBootstrapServers)
            .WaitFor(kafka!);
    }

    ConfigureFeatBitOpenTelemetry(evaluationServer, "featbit-els");
}

if (includeUi)
{
    var ui = builder
        .AddViteApp("ui", "../modules/front-end")
        .WithNpm(installCommand: "ci")
        .WithReference(apiServer)
        .WithExternalHttpEndpoints()
        .WaitFor(apiServer);

    if (evaluationServer is not null)
    {
        ui
            .WithReference(evaluationServer)
            .WaitFor(evaluationServer);
    }
}

if (includeReleaseDecisionWeb)
{
    builder
        .AddViteApp("release-decision-web", "../modules/front-end-rda-tempo")
        .WithNpm(installCommand: "ci")
        .WithReference(apiServer)
        .WithEnvironment("VITE_FEATBIT_API_URL", apiServer.GetEndpoint("http"))
        .WithEnvironment("VITE_BASE_PATH", "/")
        .WithExternalHttpEndpoints()
        .WaitFor(apiServer);
}

builder.Build().Run();

void ValidateLocalTopology()
{
    if (useExistingInfrastructure && topology != LocalTopology.StandardPostgres)
    {
        throw new InvalidOperationException(
            "Existing infrastructure mode currently supports only the StandardPostgres topology.");
    }

    if (!IsProvider(olapProvider, "None") && !IsProvider(olapProvider, "ClickHouse"))
    {
        throw new NotSupportedException("OLAPProvider must be None or ClickHouse.");
    }

    if (!IsProvider(dbProvider, "Postgres") && !IsProvider(dbProvider, "MongoDb"))
    {
        throw new NotSupportedException("DbProvider must be Postgres or MongoDb.");
    }

    if (!IsProvider(mqProvider, "Postgres") && !IsProvider(mqProvider, "Redis") && !IsProvider(mqProvider, "Kafka"))
    {
        throw new NotSupportedException("MqProvider must be Postgres, Redis, or Kafka.");
    }

    if (!IsProvider(cacheProvider, "None") && !IsProvider(cacheProvider, "Redis"))
    {
        throw new NotSupportedException("CacheProvider must be None or Redis.");
    }

    if (IsProvider(mqProvider, "Postgres") && !IsProvider(dbProvider, "Postgres"))
    {
        throw new InvalidOperationException("MqProvider=Postgres requires DbProvider=Postgres.");
    }

    if (useClickHouseOlap && !IsProvider(mqProvider, "Kafka"))
    {
        throw new InvalidOperationException("OLAPProvider=ClickHouse requires MqProvider=Kafka.");
    }

    if (!useClickHouseOlap && IsProvider(mqProvider, "Kafka"))
    {
        throw new InvalidOperationException("MqProvider=Kafka is only valid with OLAPProvider=ClickHouse.");
    }
}

bool IsProvider(string actual, string expected) =>
    string.Equals(actual, expected, StringComparison.OrdinalIgnoreCase);

void ConfigureFeatBitOpenTelemetry(IResourceBuilder<ProjectResource> resource, string serviceName)
{
    resource
        .WithOtlpExporter(OtlpProtocol.Grpc)
        .WithEnvironment("ENABLE_OPENTELEMETRY", "true")
        .WithEnvironment("OTEL_SERVICE_NAME", serviceName)
        .WithEnvironment("OTEL_TRACES_EXPORTER", "otlp")
        .WithEnvironment("OTEL_METRICS_EXPORTER", "otlp")
        .WithEnvironment("OTEL_LOGS_EXPORTER", "otlp");

    var autoHome = GetDotNetAutoInstrumentationHome();
    if (autoHome is null)
    {
        Console.WriteLine(
            ".NET Automatic Instrumentation was not found. FeatBit OTLP logs are enabled, but traces and metrics require OTEL_DOTNET_AUTO_HOME or a standard local installation.");
        return;
    }

    resource
        .WithEnvironment("OTEL_DOTNET_AUTO_HOME", autoHome)
        .WithEnvironment("DOTNET_STARTUP_HOOKS", Path.Combine(autoHome, "net", "OpenTelemetry.AutoInstrumentation.StartupHook.dll"))
        .WithEnvironment("DOTNET_ADDITIONAL_DEPS", Path.Combine(autoHome, "AdditionalDeps"))
        .WithEnvironment("DOTNET_SHARED_STORE", Path.Combine(autoHome, "store"))
        .WithEnvironment("CORECLR_ENABLE_PROFILING", "1")
        .WithEnvironment("CORECLR_PROFILER", "{918728DD-259F-4A6A-AC2B-B85E1B658318}")
        .WithEnvironment("CORECLR_PROFILER_PATH_64", Path.Combine(autoHome, "win-x64", "OpenTelemetry.AutoInstrumentation.Native.dll"));
}

string? GetDotNetAutoInstrumentationHome()
{
    var configured = Environment.GetEnvironmentVariable("OTEL_DOTNET_AUTO_HOME");
    var candidates = new[]
    {
        configured,
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".otel-dotnet-auto"),
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".opentelemetry-dotnet-auto"),
        @"C:\Program Files\OpenTelemetry .NET AutoInstrumentation",
        @"C:\ProgramData\OpenTelemetry .NET AutoInstrumentation"
    };

    return candidates.FirstOrDefault(path =>
        !string.IsNullOrWhiteSpace(path) &&
        File.Exists(Path.Combine(path, "net", "OpenTelemetry.AutoInstrumentation.StartupHook.dll")));
}

file sealed class BackendApiProject : IProjectMetadata
{
    public string ProjectPath => Path.GetFullPath("../modules/back-end/src/Api/Api.csproj", Directory.GetCurrentDirectory());

    public bool SuppressBuild => false;
}

file sealed class EvaluationApiProject : IProjectMetadata
{
    public string ProjectPath => Path.GetFullPath("../modules/evaluation-server/src/Api/Api.csproj", Directory.GetCurrentDirectory());

    public bool SuppressBuild => false;
}

enum LocalTopology
{
    Standalone,
    StandardPostgres,
    StandardMongoDb,
    ProPostgres,
    ProMongoDb
}
