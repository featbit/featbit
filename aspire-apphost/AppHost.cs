using Aspire.Hosting.ApplicationModel;

var builder = DistributedApplication.CreateBuilder(args);

var postgresUser = builder.AddParameter("postgres-user", "postgres");
var postgresPassword = builder.AddParameter("postgres-password", "please_change_me", secret: true);
var featureFlagInsightsProvider =
    Environment.GetEnvironmentVariable("FEATURE_FLAG_INSIGHTS_PROVIDER") ??
    builder.Configuration["FeatureFlagInsights:Provider"] ??
    "featbit-api";

if (featureFlagInsightsProvider is not ("featbit-api" or "featbit-das"))
{
    throw new InvalidOperationException(
        "Invalid feature flag insights provider. Use 'featbit-api' or 'featbit-das'.");
}

const string postgresConnectionString =
    "Host=localhost;Port=5432;Username=postgres;Password=please_change_me;Database=featbit";

var postgres = builder
    .AddPostgres("postgresql", postgresUser, postgresPassword, port: 5432)
    .WithBindMount("../infra/postgresql/docker-entrypoint-initdb.d", "/docker-entrypoint-initdb.d", isReadOnly: true)
    .WithDataVolume("featbit-aspire-postgres");

IResourceBuilder<ContainerResource>? daServer = null;
if (featureFlagInsightsProvider == "featbit-das")
{
    daServer = builder
        .AddContainer("da-server", "featbit/featbit-data-analytics-server:latest")
        .WithHttpEndpoint(port: 8200, targetPort: 80)
        .WithBindMount("./certs/aspire-dashboard.pem", "/etc/ssl/certs/aspire-dashboard.pem", isReadOnly: true)
        .WithEnvironment("DB_PROVIDER", "Postgres")
        .WithEnvironment("POSTGRES_USER", "postgres")
        .WithEnvironment("POSTGRES_PASSWORD", postgresPassword)
        .WithEnvironment("POSTGRES_HOST", "postgresql")
        .WithEnvironment("POSTGRES_PORT", "5432")
        .WithEnvironment("POSTGRES_DATABASE", "featbit")
        .WithEnvironment("ENABLE_OPENTELEMETRY", "true")
        .WithEnvironment("OTEL_TRACES_EXPORTER", "otlp")
        .WithEnvironment("OTEL_METRICS_EXPORTER", "otlp")
        .WithEnvironment("OTEL_LOGS_EXPORTER", "otlp")
        .WithOtlpExporter(OtlpProtocol.Grpc)
        .WithEnvironment("OTEL_SERVICE_NAME", "featbit-das")
        .WithEnvironment("OTEL_EXPORTER_OTLP_INSECURE", "false")
        .WithEnvironment("OTEL_EXPORTER_OTLP_CERTIFICATE", "/etc/ssl/certs/aspire-dashboard.pem")
        .WithEnvironment("OTEL_EXPORTER_OTLP_TRACES_CERTIFICATE", "/etc/ssl/certs/aspire-dashboard.pem")
        .WithEnvironment("OTEL_EXPORTER_OTLP_METRICS_CERTIFICATE", "/etc/ssl/certs/aspire-dashboard.pem")
        .WithEnvironment("OTEL_EXPORTER_OTLP_LOGS_CERTIFICATE", "/etc/ssl/certs/aspire-dashboard.pem")
        .WithEnvironment("GRPC_DEFAULT_SSL_ROOTS_FILE_PATH", "/etc/ssl/certs/aspire-dashboard.pem")
        .WithEnvironment("CHECK_DB_LIVNESS", "true")
        .WaitFor(postgres);
}

var apiServer = builder
    .AddProject<BackendApiProject>("api-server")
    .WithHttpEndpoint(port: 5000, targetPort: 5000, isProxied: false)
    .WithHttpsEndpoint(port: 5001, targetPort: 5001, isProxied: false)
    .WithEnvironment("ASPNETCORE_ENVIRONMENT", "Development")
    .WithEnvironment("ASPNETCORE_URLS", "http://localhost:5000;https://localhost:5001")
    .WithEnvironment("DbProvider", "Postgres")
    .WithEnvironment("MqProvider", "Postgres")
    .WithEnvironment("CacheProvider", "None")
    .WithEnvironment("Postgres__ConnectionString", postgresConnectionString)
    .WithEnvironment("OLAP__ServiceHost", "http://localhost:8200")
    .WithEnvironment("FEATURE_FLAG_INSIGHTS_PROVIDER", featureFlagInsightsProvider)
    .WithEnvironment("Jwt__Algorithm", "HS256")
    .WithEnvironment("Jwt__Key", "please_change_me_to_a_secure_secret_key")
    .WaitFor(postgres);

if (daServer is not null)
{
    apiServer.WaitFor(daServer);
}

var evaluationServer = builder
    .AddProject<EvaluationApiProject>("evaluation-server")
    .WithHttpEndpoint(port: 5100, targetPort: 5100, isProxied: false)
    .WithHttpsEndpoint(port: 5101, targetPort: 5101, isProxied: false)
    .WithEnvironment("ASPNETCORE_ENVIRONMENT", "Development")
    .WithEnvironment("ASPNETCORE_URLS", "http://localhost:5100;https://localhost:5101")
    .WithEnvironment("DbProvider", "Postgres")
    .WithEnvironment("MqProvider", "Postgres")
    .WithEnvironment("CacheProvider", "None")
    .WithEnvironment("Postgres__ConnectionString", postgresConnectionString)
    .WaitFor(postgres);

ConfigureFeatBitOpenTelemetry(apiServer, "featbit-api");
ConfigureFeatBitOpenTelemetry(evaluationServer, "featbit-els");

builder
    .AddExecutable("ui", "npm", "../modules/front-end", "run", "start")
    .WithHttpEndpoint(port: 4200, targetPort: 4200, isProxied: false)
    .WithEnvironment("FEATURE_FLAG_INSIGHTS_PROVIDER", featureFlagInsightsProvider)
    .WaitFor(apiServer)
    .WaitFor(evaluationServer);

if (featureFlagInsightsProvider == "featbit-api")
{
    builder
        .AddExecutable("release-decision-web", "npm", "../modules/release-decision-web", "run", "dev")
        .WithHttpEndpoint(port: 3000, targetPort: 3000, isProxied: false)
        .WithEnvironment("PORT", "3000")
        .WithEnvironment("VITE_FEATBIT_APP_URL", "http://localhost:4200")
        .WithEnvironment("VITE_FEATBIT_API_URL", "http://localhost:5000")
        .WithEnvironment("VITE_BASE_PATH", "/release-decision")
        .WaitFor(apiServer);
}

builder.Build().Run();

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
