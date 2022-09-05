using System.Text.Json;

namespace Domain.UnitTests;

public class UserTests
{
    [Fact]
    public void Should_Deserialize_From_Json()
    {
        var json =
            "{'userName':'rick','email':'rick@universe.com','userKeyId':'97f202d6-db9e-4da2-a465-1b35f8621858','customizedProperties':[{'name':'role','value':'bad-guy'},{'name':'中文名','value':'瑞克'}]}".Replace('\'', '"');

        // use web defaults JsonSerializerOptions
        // https://docs.microsoft.com/en-us/dotnet/standard/serialization/system-text-json-configure-options?pivots=dotnet-6-0#web-defaults-for-jsonserializeroptions
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var actual = JsonSerializer.Deserialize<User>(json, options);

        Assert.NotNull(actual);

        Assert.Equal("97f202d6-db9e-4da2-a465-1b35f8621858", actual.UserKeyId);
        Assert.Equal("rick", actual.UserName);
        Assert.Equal("rick@universe.com", actual.Email);
        Assert.Null(actual.Country);

        Assert.NotNull(actual.CustomizedProperties);
        Assert.Equal("role", actual.CustomizedProperties[0].Name);
        Assert.Equal("bad-guy", actual.CustomizedProperties[0].Value);
        Assert.Equal("中文名", actual.CustomizedProperties[1].Name);
        Assert.Equal("瑞克", actual.CustomizedProperties[1].Value);
    }
}