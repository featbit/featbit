using DotNet.Testcontainers.Builders;
using DotNet.Testcontainers.Containers;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Infrastructure.IntegrationTests.Fixtures;

/// <summary>
/// Spins up the Azure Cosmos DB emulator with its MongoDB endpoint enabled.
/// </summary>
public sealed class CosmosMongoDbFixture : IAsyncLifetime
{
    private const string EmulatorKey =
        "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==";

    // private readonly IContainer _container = new ContainerBuilder("mcr.azure.cn/cosmosdb/linux/azure-cosmos-emulator:latest")
    private readonly IContainer _container = new ContainerBuilder("mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest")
        .WithEnvironment("AZURE_COSMOS_EMULATOR_ENABLE_MONGODB_ENDPOINT", "4.2")
        .WithEnvironment("AZURE_COSMOS_EMULATOR_PARTITION_COUNT", "1")
        .WithPortBinding(10255, true)
        .WithWaitStrategy(Wait.ForUnixContainer().UntilInternalTcpPortIsAvailable(10255))
        .Build();

    public string ConnectionString =>
        $"mongodb://localhost:{Uri.EscapeDataString(EmulatorKey)}@localhost:{_container.GetMappedPublicPort(10255)}/admin" +
        "?tls=true&tlsInsecure=true&retrywrites=false&directConnection=true";

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        await _container.StartAsync();
    }

    public async Task DisposeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        await _container.DisposeAsync();
    }

    public async Task CreateDatabaseAsync(string databaseName, params string[] collectionNames)
    {
        var database = new MongoClient(ConnectionString).GetDatabase(databaseName);

        await database.RunCommandAsync<BsonDocument>(new BsonDocument
        {
            { "customAction", "CreateDatabase" },
            { "offerThroughput", 400 }
        });

        foreach (var collectionName in collectionNames)
        {
            await database.RunCommandAsync<BsonDocument>(new BsonDocument
            {
                { "customAction", "CreateCollection" },
                { "collection", collectionName }
            });
        }
    }
}
