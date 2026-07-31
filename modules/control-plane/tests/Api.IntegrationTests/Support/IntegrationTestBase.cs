namespace Api.IntegrationTests.Support;

/// <summary>
/// Base class for all integration test classes in this project. Tags every test with
/// <c>Category=Integration</c> so CI can exclude the suite via <c>--filter "Category!=Integration"</c>.
/// </summary>
[Trait("Category", "Integration")]
public abstract class IntegrationTestBase
{
}
