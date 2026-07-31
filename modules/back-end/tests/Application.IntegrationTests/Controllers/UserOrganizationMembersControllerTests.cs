using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Api;
using Api.Controllers;
using Application.Bases.Models;
using Application.Members;
using Moq;

namespace Application.IntegrationTests.Controllers;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class UserOrganizationMembersControllerTests : IClassFixture<PermissionCheckTestApp>
{
    private static readonly Guid OrganizationId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly PermissionCheckTestApp _app;

    public UserOrganizationMembersControllerTests(PermissionCheckTestApp app)
    {
        _app = app;
        _app.PermissionChecker.Grant = false;
        _app.PermissionChecker.Calls.Clear();
        _app.Sender.Reset();
    }

    [Fact]
    public async Task GetOrganizationMembersAsync_AuthenticatedWithoutIamPermission_ReturnsLookupMembers()
    {
        var expected = new PagedResult<MemberLookupVm>(1,
        [
            new MemberLookupVm
            {
                Id = "member-1",
                Name = "Maya Chen",
                Email = "maya@example.com"
            }
        ]);
        _app.Sender
            .Setup(sender => sender.Send(It.IsAny<GetMemberLookupList>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);
        var client = await _app.CreateAuthenticatedClientAsync();
        client.DefaultRequestHeaders.Add(ApiConstants.OrgIdHeaderKey, OrganizationId.ToString());

        var response = await client.GetAsync(
            "/api/v1/user/organization-members?searchText=maya&pageIndex=1&pageSize=20");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<PagedResult<MemberLookupVm>>>(JsonOptions);
        Assert.NotNull(body);
        Assert.True(body!.Success);
        var item = Assert.Single(body.Data!.Items);
        Assert.Equal("member-1", item.Id);
        Assert.Equal("Maya Chen", item.Name);
        Assert.Equal("maya@example.com", item.Email);
        _app.Sender.Verify(sender => sender.Send(
                It.Is<GetMemberLookupList>(request =>
                    request.OrganizationId == OrganizationId &&
                    request.Filter.SearchText == "maya" &&
                    request.Filter.PageIndex == 1 &&
                    request.Filter.PageSize == 20),
                It.IsAny<CancellationToken>()),
            Times.Once);
        Assert.Empty(_app.PermissionChecker.Calls);
    }

    [Fact]
    public async Task GetOrganizationMembersAsync_Unauthenticated_Returns401()
    {
        var response = await _app.CreateClient().GetAsync("/api/v1/user/organization-members");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        _app.Sender.Verify(
            sender => sender.Send(It.IsAny<GetMemberLookupList>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
