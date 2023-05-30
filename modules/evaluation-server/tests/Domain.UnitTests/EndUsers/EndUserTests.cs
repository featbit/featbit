using System.Text.Json;
using Domain.Shared;
using Domain.EndUsers;

namespace Domain.UnitTests.EndUsers;

public class EndUserTests
{
    [Fact]
    public void DeserializeFromJson()
    {
        var json =
            "{'name':'rick','keyId':'97f202d6-db9e-4da2-a465-1b35f8621858','customizedProperties':[{'name':'role','value':'bad-guy'},{'name':'中文名','value':'瑞克'}]}"
                .Replace('\'', '"');

        var actual = JsonSerializer.Deserialize<EndUser>(json, ReusableJsonSerializerOptions.Web);

        Assert.NotNull(actual);

        Assert.Equal("97f202d6-db9e-4da2-a465-1b35f8621858", actual.KeyId);
        Assert.Equal("rick", actual.Name);

        Assert.NotNull(actual.CustomizedProperties);
        Assert.Equal("role", actual.CustomizedProperties[0].Name);
        Assert.Equal("bad-guy", actual.CustomizedProperties[0].Value);
        Assert.Equal("中文名", actual.CustomizedProperties[1].Name);
        Assert.Equal("瑞克", actual.CustomizedProperties[1].Value);
    }
}