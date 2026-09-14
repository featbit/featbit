using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Api.Controllers;
using Application.Bases;
using Application.FeatureFlags;
using Application.Services;
using Domain.Environments;
using Domain.FeatureFlags;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;
using Environment = Domain.Environments.Environment;

namespace Application.IntegrationTests.Controllers;

[Collection(nameof(TestApp))]
[Trait("Category", "Host")]
public class FeatureFlagToggleValidationTests(TestApp app)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    [Theory]
    [InlineData(true, false, null, false)]
    [InlineData(true, true, null, false)]
    [InlineData(true, false, "{}", false)]
    [InlineData(true, false, "{\"comment\":null}", false)]
    [InlineData(true, false, "{\"comment\":\"\"}", false)]
    [InlineData(true, true, "{\"comment\":\" \\t\\n \"}", false)]
    [InlineData(true, false, "{\"comment\":\"  Release approved  \"}", true)]
    [InlineData(true, true, "{\"comment\":\"发布审批通过\"}", true)]
    [InlineData(false, false, null, true)]
    [InlineData(false, true, "{}", true)]
    [InlineData(false, false, "{\"comment\":null}", true)]
    [InlineData(false, true, "{\"comment\":\"\"}", true)]
    [InlineData(false, false, "{\"comment\":\" \\t\\n \"}", true)]
    public async Task Toggle_EnforcesEnvironmentCommentRequirement(
        bool requireComment, bool nextEnabled, string? body, bool expectedSuccess)
    {
        var environment = new Environment(Guid.NewGuid(), "Production", "production",
            settings: new EnvironmentSettings { RequireChangeComment = requireComment });
        var flag = new FeatureFlag
        {
            Id = Guid.NewGuid(),
            EnvId = environment.Id,
            Key = "checkout",
            IsEnabled = !nextEnabled,
            Revision = Guid.NewGuid()
        };
        var originalRevision = flag.Revision;
        var flagService = new Mock<IFeatureFlagService>();
        flagService.Setup(x => x.GetAsync(environment.Id, flag.Key)).ReturnsAsync(flag);
        var environmentService = new Mock<IEnvironmentService>();
        environmentService.Setup(x => x.GetAsync(environment.Id)).ReturnsAsync(environment);
        var publisher = new Mock<IPublisher>();

        // Keep the real controller, mediator, handler and exception middleware.
        using var factory = app.WithServices(services =>
        {
            services.Replace(ServiceDescriptor.Singleton(flagService.Object));
            services.Replace(ServiceDescriptor.Singleton(environmentService.Object));
            services.Replace(ServiceDescriptor.Singleton(publisher.Object));
        });
        using var client = await app.CreateAuthenticatedClientAsync(factory);
        using var content = body == null ? null : new StringContent(body, Encoding.UTF8, "application/json");

        var response = await client.PutAsync(
            $"/api/v1/envs/{environment.Id}/feature-flags/{flag.Key}/toggle/{nextEnabled}", content);

        if (expectedSuccess)
        {
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var result = await response.Content.ReadFromJsonAsync<ApiResponse<Guid>>(JsonOptions);
            Assert.NotNull(result);
            Assert.True(result.Success);
            Assert.Equal(nextEnabled, flag.IsEnabled);
            Assert.NotEqual(originalRevision, flag.Revision);
            Assert.Equal(flag.Revision, result.Data);
            flagService.Verify(x => x.UpdateAsync(flag), Times.Once);

            var expectedComment = body == null ? string.Empty
                : JsonSerializer.Deserialize<Application.AuditLogs.ResourceChangeRequest>(body, JsonOptions)?.Comment ?? string.Empty;
            publisher.Verify(x => x.Publish(
                It.Is<OnFeatureFlagChanged>(notification =>
                    notification.Flag == flag && notification.Comment == expectedComment),
                It.IsAny<CancellationToken>()), Times.Once);
        }
        else
        {
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            var result = await response.Content.ReadFromJsonAsync<ApiResponse<object>>(JsonOptions);
            Assert.NotNull(result);
            Assert.False(result.Success);
            Assert.Equal([ErrorCodes.Required("comment")], result.Errors);
            Assert.Equal(!nextEnabled, flag.IsEnabled);
            Assert.Equal(originalRevision, flag.Revision);
            flagService.Verify(x => x.UpdateAsync(It.IsAny<FeatureFlag>()), Times.Never);
            publisher.Verify(x => x.Publish(It.IsAny<OnFeatureFlagChanged>(), It.IsAny<CancellationToken>()), Times.Never);
        }
    }
}
