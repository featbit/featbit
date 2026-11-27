using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Domain.EndUsers;
using Domain.Messages;
using Domain.Usages;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Application.IntegrationTests.Controllers;

[Collection(nameof(TestApp))]
public class SdkControllerTests(TestApp app)
{
    [Theory]
    [InlineData(0)]
    [InlineData(4102444800000L)]
    public async Task ClientSync_DeduplicatesEndUserAndReportsMauOnEachSyncIncludingEmptyPatch(long timestamp)
    {
        var producer = new Mock<IMessageProducer>();
        using var host = app.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.Replace(ServiceDescriptor.Singleton<IMessageProducer>(producer.Object))));
        using var client = host.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(TestData.ClientSecretString);

        for (var i = 0; i < 2; i++)
        {
            using var response = await client.PostAsJsonAsync($"/api/public/sdk/client/latest-all?timestamp={timestamp}",
                new EndUser { KeyId = "user-a" });
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        producer.Verify(p => p.PublishAsync(Topics.EndUser, It.Is<EndUserMessage>(u =>
            u.EnvId == TestData.ClientEnvId && u.KeyId == "user-a")), Times.Once);
        producer.Verify(p => p.PublishAsync(Topics.Usage, It.Is<InsightUsage>(u =>
            u.EnvId == TestData.ClientEnvId && u.EndUsers.Count == 1 && u.EndUsers.Contains("user-a") &&
            u.FlagEvaluations == 0 && u.CustomMetrics == 0)), Times.Exactly(2));
        producer.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task ServerSync_DoesNotPublishUsage()
    {
        var producer = new Mock<IMessageProducer>();
        using var host = app.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.Replace(ServiceDescriptor.Singleton<IMessageProducer>(producer.Object))));
        using var client = host.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(TestData.ServerSecretString);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/public/sdk/server/latest-all")).StatusCode);
        producer.VerifyNoOtherCalls();
    }
}
