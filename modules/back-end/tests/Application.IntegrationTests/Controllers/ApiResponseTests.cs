using Api.Controllers;

namespace Application.IntegrationTests.Controllers;

public class ApiResponseTests
{
    [Fact]
    public void Ok_Always_ReturnsSuccessfulResponseWithProvidedData()
    {
        var response = ApiResponse<string>.Ok("payload");

        Assert.True(response.Success);
        Assert.Empty(response.Errors);
        Assert.Equal("payload", response.Data);
    }

    [Fact]
    public void Ok_NullData_ReturnsSuccessfulResponseWithNullData()
    {
        var response = ApiResponse<string>.Ok(null);

        Assert.True(response.Success);
        Assert.Empty(response.Errors);
        Assert.Null(response.Data);
    }

    [Fact]
    public void ErrorSingleString_Always_ReturnsFailureResponseWithSingleErrorAndNoData()
    {
        var response = ApiResponse<int>.Error("boom");

        Assert.False(response.Success);
        Assert.Equal(new[] { "boom" }, response.Errors);
        Assert.Equal(default, response.Data);
    }

    [Fact]
    public void ErrorCollection_Always_ReturnsFailureResponseWithAllErrors()
    {
        var errors = new[] { "a", "b" };

        var response = ApiResponse<int>.Error(errors);

        Assert.False(response.Success);
        Assert.Equal(errors, response.Errors);
        Assert.Equal(default, response.Data);
    }

    [Fact]
    public void RecordEquality_TwoOkWithSameData_AreEqual()
    {
        var a = ApiResponse<string>.Ok("x");
        var b = ApiResponse<string>.Ok("x");

        Assert.Equal(a, b);
    }

    [Fact]
    public void RecordEquality_OkVsError_AreNotEqual()
    {
        var ok = ApiResponse<string>.Ok("x");
        var err = ApiResponse<string>.Error("x");

        Assert.NotEqual(ok, err);
    }
}
