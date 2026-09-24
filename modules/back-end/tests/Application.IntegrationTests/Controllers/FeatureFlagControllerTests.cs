using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Api.Controllers;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.Experiments;
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

    [Fact]
    public async Task GetInsightsAsync_PermissionDenied_Returns403()
    {
        _app.PermissionChecker.Grant = false;

        var client = await _app.CreateAuthenticatedClientAsync();
        var response = await client.GetAsync(
            $"/api/v1/envs/{EnvId}/feature-flags/insights?featureFlagKey=checkout&intervalType=DAY&from=1&to=2");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        _app.Sender.Verify(
            s => s.Send(It.IsAny<GetInsights>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task UpdateGeneralAsync_Authenticated_SendsCombinedRequest()
    {
        var expectedRevision = Guid.NewGuid();
        _app.Sender
            .Setup(s => s.Send(It.IsAny<UpdateGeneral>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expectedRevision);

        var client = await _app.CreateAuthenticatedClientAsync();
        var response = await client.PutAsJsonAsync(
            $"/api/v1/envs/{EnvId}/feature-flags/checkout/general",
            new
            {
                name = "Checkout rollout",
                description = "Updated description",
                tags = new[] { "checkout", "release" },
                comment = "Update general settings"
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<Guid>>(JsonOptions);
        Assert.NotNull(body);
        Assert.True(body!.Success);
        Assert.Equal(expectedRevision, body.Data);
        _app.Sender.Verify(
            s => s.Send(
                It.Is<UpdateGeneral>(r =>
                    r.EnvId == EnvId &&
                    r.Key == "checkout" &&
                    r.Name == "Checkout rollout" &&
                    r.Description == "Updated description" &&
                    r.Tags.SequenceEqual(new[] { "checkout", "release" }) &&
                    r.Comment == "Update general settings"),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task PatchAsync_InsightsRequiredByExperiment_Returns409NamingExperiments()
    {
        var experiment = new ExperimentRef(Guid.NewGuid(), "Checkout copy test");
        _app.Sender
            .Setup(s => s.Send(It.IsAny<PatchFeatureFlag>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InsightsRequiredByExperimentException([experiment]));

        var client = await _app.CreateAuthenticatedClientAsync();
        var response = await client.PatchAsync(
            $"/api/v1/envs/{EnvId}/feature-flags/checkout",
            JsonContent.Create(new[] { new { op = "replace", path = "/insightsEnabled", value = false } }));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);
        Assert.False(body.GetProperty("success").GetBoolean());
        Assert.Equal(
            ErrorCodes.InsightsRequiredByRunningExperiment,
            body.GetProperty("errors")[0].GetString());
        var returned = body.GetProperty("data").GetProperty("experiments")[0];
        Assert.Equal(experiment.Id, returned.GetProperty("id").GetGuid());
        Assert.Equal(experiment.Name, returned.GetProperty("name").GetString());
    }

    [Fact]
    public async Task GetRunningExperimentsAsync_PermissionGranted_ReturnsExperiments()
    {
        var experiment = new ExperimentRef(Guid.NewGuid(), "Checkout copy test");
        _app.Sender
            .Setup(s => s.Send(It.IsAny<GetRunningExperiments>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([experiment]);

        var client = await _app.CreateAuthenticatedClientAsync();
        var response = await client.GetAsync($"/api/v1/envs/{EnvId}/feature-flags/checkout/running-experiments");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<ExperimentRef[]>>(JsonOptions);
        Assert.Equal([experiment], body!.Data);
        _app.Sender.Verify(
            s => s.Send(
                It.Is<GetRunningExperiments>(r => r.EnvId == EnvId && r.Key == "checkout"),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task GetRunningExperimentsAsync_PermissionDenied_Returns403()
    {
        _app.PermissionChecker.Grant = false;

        var client = await _app.CreateAuthenticatedClientAsync();
        var response = await client.GetAsync($"/api/v1/envs/{EnvId}/feature-flags/checkout/running-experiments");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task UpdateGeneralAsync_WithInsightsEnabled_PassesValueToRequest()
    {
        _app.Sender
            .Setup(s => s.Send(It.IsAny<UpdateGeneral>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Guid.NewGuid());

        var client = await _app.CreateAuthenticatedClientAsync();
        var response = await client.PutAsJsonAsync(
            $"/api/v1/envs/{EnvId}/feature-flags/checkout/general",
            new { name = "Checkout", description = "", tags = Array.Empty<string>(), insightsEnabled = false });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        _app.Sender.Verify(
            s => s.Send(It.Is<UpdateGeneral>(r => r.InsightsEnabled == false), It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
