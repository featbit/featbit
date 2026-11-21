using System.Text.Json;
using Application.Bases.Exceptions;
using Application.Services;
using Domain.ObservabilityProviders;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Persistence.MongoDb;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MongoDB.Driver;
using MongoService = Infrastructure.Services.MongoDb.ObservabilityProviderService;
using PostgresService = Infrastructure.Services.EntityFrameworkCore.ObservabilityProviderService;

namespace Infrastructure.IntegrationTests.Services;

[Collection(FeatBitPostgresCollection.Name)]
public sealed class PostgresObservabilityProviderServiceTests(FeatBitPostgresFixture fixture) : IntegrationTestBase
{
    [DockerFact]
    public async Task CrudWithProductionSchema()
    {
        await using var dbContext = AppDbContextFactory.Create(fixture.ConnectionString);
        var id = await ObservabilityProviderScenario.ExerciseAsync(new PostgresService(dbContext));
        var deleted = await dbContext.Set<ObservabilityProvider>().AsNoTracking().SingleAsync(x => x.Id == id);
        Assert.True(deleted.IsDeleted);
        Assert.Null(deleted.ProtectedCredential);
    }
}

[Collection(MongoCollection.Name)]
public sealed class MongoObservabilityProviderServiceTests(MongoDbFixture fixture) : IntegrationTestBase
{
    [DockerFact]
    public async Task CrudWithProductionSchema()
    {
        var assembly = typeof(MongoObservabilityProviderServiceTests).Assembly;
        await using var stream = assembly.GetManifestResourceStream("FeatBitMongoInitDb.v6.2.0.js")!;
        using var reader = new StreamReader(stream);
        var migration = await fixture.ExecuteScriptAsync(await reader.ReadToEndAsync());
        Assert.True(migration.ExitCode == 0, migration.Stderr);

        var mongoDb = new MongoDbClient(Options.Create(new MongoDbOptions
        {
            ConnectionString = fixture.ConnectionString,
            Database = "featbit"
        }));
        var id = await ObservabilityProviderScenario.ExerciseAsync(new MongoService(mongoDb));
        var deleted = await mongoDb.CollectionOf<ObservabilityProvider>().Find(x => x.Id == id).SingleAsync();
        Assert.True(deleted.IsDeleted);
        Assert.Null(deleted.ProtectedCredential);
    }
}

internal static class ObservabilityProviderScenario
{
    public static async Task<Guid> ExerciseAsync(IObservabilityProviderService service)
    {
        var envId = Guid.NewGuid();
        var otherEnv = Guid.NewGuid();
        var ct = CancellationToken.None;
        var original = Provider(envId);
        await service.AddAsync(original, ct);
        await Assert.ThrowsAsync<ConflictException>(() => service.AddAsync(Provider(envId), ct));
        await service.AddAsync(Provider(otherEnv), ct);
        Assert.Null(await service.FindAsync(otherEnv, original.Id, ct));
        Assert.False(await service.DeleteAsync(otherEnv, original.Id, Guid.NewGuid(), ct));

        var stored = Assert.Single(await service.GetListAsync(envId, ct));
        Assert.Equal("https://metrics.test", stored.ConnectionConfiguration.ProviderConfig.GetProperty("endpoint").GetString());
        Assert.Equal("bearer_token", stored.ConnectionConfiguration.Authentication.GetProperty("type").GetString());
        Assert.Equal("encrypted-slot", stored.ProtectedCredential);

        var another = Provider(envId);
        another.Name = "Other metrics";
        await service.AddAsync(another, ct);
        another.Name = stored.Name;
        await Assert.ThrowsAsync<ConflictException>(() => service.UpdateAsync(another, another.Version, ct));
        Assert.Equal("Other metrics", (await service.FindAsync(envId, another.Id, ct))!.Name);
        Assert.True(await service.DeleteAsync(envId, another.Id, Guid.NewGuid(), ct));

        var stale = (await service.FindAsync(envId, original.Id, ct))!;
        var expectedVersion = stored.Version;
        stored.ConnectionConfiguration = new ProviderConnectionConfiguration(
            JsonSerializer.SerializeToElement(new { endpoint = "https://new.test" }), stored.ConnectionConfiguration.Authentication);
        stored.Version++;
        Assert.True(await service.UpdateAsync(stored, expectedVersion, ct));
        Assert.False(await service.UpdateAsync(stale, expectedVersion, ct));
        var updated = (await service.FindAsync(envId, original.Id, ct))!;
        Assert.Equal("https://new.test", updated.ConnectionConfiguration.ProviderConfig.GetProperty("endpoint").GetString());

        Assert.True(await service.DeleteAsync(envId, original.Id, Guid.NewGuid(), ct));
        Assert.Null(await service.FindAsync(envId, original.Id, ct));
        Assert.Empty(await service.GetListAsync(envId, ct));
        Assert.False(await service.UpdateAsync(stored, updated.Version, ct));
        Assert.False(await service.DeleteAsync(envId, original.Id, Guid.NewGuid(), ct));
        var replacement = Provider(envId);
        await service.AddAsync(replacement, ct);
        Assert.Equal(replacement.Id, Assert.Single(await service.GetListAsync(envId, ct)).Id);
        return original.Id;
    }

    private static ObservabilityProvider Provider(Guid envId) => new()
    {
        Id = Guid.NewGuid(),
        EnvId = envId,
        Name = "Production metrics",
        ProviderType = "prometheus-compatible",
        ProviderSchemaVersion = 1,
        ConnectionConfiguration = new ProviderConnectionConfiguration(
            JsonSerializer.SerializeToElement(new { endpoint = "https://metrics.test" }),
            JsonSerializer.SerializeToElement(new { type = "bearer_token" })),
        ProtectedCredential = "encrypted-slot",
        Revision = 1,
        Version = 1
    };
}
