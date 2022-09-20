using System.Net.Http.Json;
using Api.Controllers;

namespace Application.IntegrationTests.Basics;

public class BasicControllerTests : IClassFixture<TestApp>
{
    private readonly TestApp _app;

    public BasicControllerTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task ApiVersioning()
    {
        var client = _app.CreateClient();

        var v1 = await client.GetAsync("api/v1/basic/string");
        var v2 = await client.GetAsync("api/v2/basic/string");
        
        Assert.True(v1.IsSuccessStatusCode);
        Assert.True(v2.IsSuccessStatusCode);

        var v1Content = await v1.Content.ReadFromJsonAsync<ApiResponse>();
        var v2Content = await v2.Content.ReadFromJsonAsync<ApiResponse>();
        
        Assert.NotNull(v1Content);
        Assert.NotNull(v2Content);
        
        Assert.Equal("v1", v1Content.Data!.ToString());
        Assert.Equal("v2", v2Content.Data!.ToString());
    }
}