namespace Infrastructure.IntegrationTests.ReleaseDecisions;

[CollectionDefinition(nameof(ReleaseDecisionProviderParityCollection))]
public sealed class ReleaseDecisionProviderParityCollection
    : ICollectionFixture<ReleaseDecisionProviderParityFixture>;
