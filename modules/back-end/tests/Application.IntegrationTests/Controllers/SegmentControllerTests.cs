using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Api.Controllers;
using Application.Segments;
using MediatR;
using Moq;

namespace Application.IntegrationTests.Controllers;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class SegmentControllerTests : IClassFixture<PermissionCheckTestApp>
{
    private static readonly Guid EnvId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid SegmentId = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly PermissionCheckTestApp _app;

    public SegmentControllerTests(PermissionCheckTestApp app)
    {
        _app = app;
        _app.PermissionChecker.Grant = true;
        _app.PermissionChecker.Calls.Clear();
        _app.Sender.Reset();
    }

    [Fact]
    public async Task UpdateGeneralAsync_Authenticated_SendsCombinedRequest()
    {
        _app.Sender
            .Setup(s => s.Send(It.IsAny<UpdateGeneral>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var client = await _app.CreateAuthenticatedClientAsync();
        var response = await client.PutAsJsonAsync(
            $"/api/v1/envs/{EnvId}/segments/{SegmentId}/general",
            new
            {
                name = "Release users",
                description = "Updated description",
                tags = new[] { "release", "beta" },
                comment = "Update general settings"
            });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ApiResponse<bool>>(JsonOptions);
        Assert.NotNull(body);
        Assert.True(body!.Success);
        Assert.True(body.Data);
        _app.Sender.Verify(
            s => s.Send(
                It.Is<UpdateGeneral>(r =>
                    r.Id == SegmentId &&
                    r.Name == "Release users" &&
                    r.Description == "Updated description" &&
                    r.Tags.SequenceEqual(new[] { "release", "beta" }) &&
                    r.Comment == "Update general settings"),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
