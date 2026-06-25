using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Api.Controllers;
using Application.Bases;
using Application.Bases.Models;
using Application.FeatureFlags;
using MediatR;
using Moq;

namespace Application.IntegrationTests.Controllers;

/// <summary>
/// Template test for permission-tagged endpoints. Uses <see cref="PermissionCheckTestApp"/>
/// to swap <see cref="Api.Authorization.IPermissionChecker"/> and <see cref="ISender"/> so
/// each test can drive the policy outcome and the mediator response independently.
///
/// Copy this pattern when adding the first integration test for any controller that uses
/// <c>[Authorize(Permissions.X)]</c>. The deep handler/service stubbing is unnecessary because
/// handler logic is covered separately in <c>Application.UnitTests</c>.
/// </summary>
[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class FeatureFlagControllerTests : IClassFixture<PermissionCheckTestApp>
{
    private static readonly Guid EnvId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly PermissionCheckTestApp _app;

    public FeatureFlagControllerTests(PermissionCheckTestApp app)
    {
        _app = app;
        _app.PermissionChecker.Grant = true;
        _app.PermissionChecker.Calls.Clear();
        _app.Sender.Reset();
    }

    [Fact]
    public async Task GetListAsync_PermissionGranted_Returns200WithPagedResult()
    {
        var expected = new PagedResult<FeatureFlagVm>(0, Array.Empty<FeatureFlagVm>());
        _app.Sender
            .Setup(s => s.Send(It.IsAny<GetFeatureFlagList>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var client = await _app.CreateAuthenticatedClientAsync();
        var response = await client.GetAsync($"/api/v1/envs/{EnvId}/feature-flags");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<PagedResult<FeatureFlagVm>>>(JsonOptions);
        Assert.NotNull(body);
        Assert.True(body!.Success);
        Assert.Equal(0, body.Data!.TotalCount);
        _app.Sender.Verify(
            s => s.Send(It.Is<GetFeatureFlagList>(r => r.EnvId == EnvId), It.IsAny<CancellationToken>()),
            Times.Once);
        Assert.Single(_app.PermissionChecker.Calls);
    }

    [Fact]
    public async Task GetListAsync_PermissionDenied_Returns403WithForbiddenErrorCode()
    {
        _app.PermissionChecker.Grant = false;

        var client = await _app.CreateAuthenticatedClientAsync();
        var response = await client.GetAsync($"/api/v1/envs/{EnvId}/feature-flags");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>(JsonOptions);
        Assert.NotNull(body);
        Assert.False(body!.Success);
        Assert.Contains(ErrorCodes.Forbidden, body.Errors);
        _app.Sender.Verify(
            s => s.Send(It.IsAny<GetFeatureFlagList>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task GetListAsync_Unauthenticated_Returns401()
    {
        var response = await _app.CreateClient().GetAsync($"/api/v1/envs/{EnvId}/feature-flags");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        _app.Sender.Verify(
            s => s.Send(It.IsAny<GetFeatureFlagList>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
