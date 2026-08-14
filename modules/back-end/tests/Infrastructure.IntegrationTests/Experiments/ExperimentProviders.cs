namespace Infrastructure.IntegrationTests.Experiments;

[Collection(nameof(ExperimentProviderParityCollection))]
public sealed class MongoDbExperimentProviderTests(ExperimentProviderParityFixture fixture)
    : WritableExperimentProviderTestsBase(fixture)
{
    protected override string ProviderName => "MongoDb";
}

[Collection(nameof(ExperimentProviderParityCollection))]
public sealed class PostgresExperimentProviderTests(ExperimentProviderParityFixture fixture)
    : WritableExperimentProviderTestsBase(fixture)
{
    protected override string ProviderName => "Postgres";
}

[Collection(nameof(ExperimentProviderParityCollection))]
public sealed class ClickHouseExperimentProviderTests(ExperimentProviderParityFixture fixture)
    : ExperimentProviderTestsBase(fixture)
{
    protected override string ProviderName => "ClickHouse";
}
