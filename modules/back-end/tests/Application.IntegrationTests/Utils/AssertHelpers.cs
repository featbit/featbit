using System.Net;
using System.Net.Http.Json;
using Api.Controllers;

namespace Application.IntegrationTests.Utils;

public static class AssertHelpers
{
    public static void BadRequest(HttpResponseMessage? response, string[]? errors = null)
    {
        Assert.NotNull(response);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var content = response.Content.ReadFromJsonAsync<ApiResponse>().Result;
        Assert.NotNull(content);

        Assert.False(content.Success);
        Assert.Null(content.Data);
        if (errors != null && errors.Any())
        {
            Assert.True(
                errors.OrderBy(x => x).SequenceEqual(content.Errors.OrderBy(y => y))
            );
        }
    }
}