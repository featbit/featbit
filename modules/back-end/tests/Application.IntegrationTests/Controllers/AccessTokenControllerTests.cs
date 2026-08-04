using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Api;
using Api.Controllers;
using Application.AccessTokens;
using Application.Bases;
using Application.Bases.Models;
using Domain.Policies;
using Moq;

namespace Application.IntegrationTests.Controllers;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class AccessTokenControllerTests : IClassFixture<PermissionCheckTestApp>
{
    private static readonly Guid OrganizationId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly PermissionCheckTestApp _app;

    public AccessTokenControllerTests(PermissionCheckTestApp app)
    {
        _app = app;
        _app.PermissionChecker.Grant = true;
        _app.PermissionChecker.Calls.Clear();
        _app.Sender.Reset();
    }

    [Fact]
    public async Task GetListAsync_ListPermissionGranted_Returns200()
    {
        var expected = new PagedResult<AccessTokenVm>(0, Array.Empty<AccessTokenVm>());
        _app.Sender
            .Setup(sender => sender.Send(It.IsAny<GetAccessTokenList>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);
        var client = await _app.CreateAuthenticatedClientAsync();
        client.DefaultRequestHeaders.Add(ApiConstants.OrgIdHeaderKey, OrganizationId.ToString());

        var response = await client.GetAsync("/api/v1/access-tokens?pageIndex=0&pageSize=10");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<PagedResult<AccessTokenVm>>>(JsonOptions);
        Assert.NotNull(body);
        Assert.True(body!.Success);
        Assert.Equal(0, body.Data!.TotalCount);
        _app.Sender.Verify(sender => sender.Send(
            It.Is<GetAccessTokenList>(request => request.OrganizationId == OrganizationId),
            It.IsAny<CancellationToken>()), Times.Once);
        Assert.Single(_app.PermissionChecker.Calls);
        Assert.Equal(Permissions.ListAccessTokens, _app.PermissionChecker.Calls[0].PermissionName);
    }

    [Fact]
    public async Task GetListAsync_ListPermissionDenied_Returns403WithoutQueryingMediator()
    {
        _app.PermissionChecker.Grant = false;
        var client = await _app.CreateAuthenticatedClientAsync();
        client.DefaultRequestHeaders.Add(ApiConstants.OrgIdHeaderKey, OrganizationId.ToString());

        var response = await client.GetAsync("/api/v1/access-tokens?pageIndex=0&pageSize=10");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<object>>(JsonOptions);
        Assert.NotNull(body);
        Assert.False(body!.Success);
        Assert.Contains(ErrorCodes.Forbidden, body.Errors);
        _app.Sender.Verify(sender => sender.Send(
            It.IsAny<GetAccessTokenList>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
