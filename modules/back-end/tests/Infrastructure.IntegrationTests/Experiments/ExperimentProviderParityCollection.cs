namespace Infrastructure.IntegrationTests.Experiments;

[CollectionDefinition(nameof(ExperimentProviderParityCollection))]
public sealed class ExperimentProviderParityCollection
    : ICollectionFixture<ExperimentProviderParityFixture>;
