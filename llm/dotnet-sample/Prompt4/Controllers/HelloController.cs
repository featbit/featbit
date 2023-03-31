using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using Microsoft.AspNetCore.Mvc;

namespace T4Prompt.Controllers;

#if true 
// In the given code, eliminate the feature flags tied to the key `language`, while preserving the code associated with the `zh-cn` return value. Also, maintain any other code not related to these feature flags. Ignore the defaultValue. Provide just the code, excluding any descriptions.

[ApiController]
[Route("[controller]")]
public class HelloController : ControllerBase
{
    private readonly FbClient _client;

    public HelloController(FbClient client)
    {
        _client = client;
    }

    [HttpGet]
    public string HelloWorld()
    {
        var u = FbUser.Builder("bob").Name("bob").Build();

        var variation = _client.StringVariation("language", u, "en-us");
        return variation switch
        {
            "zh-cn" => "你好世界！",
            "en-us" => "Hello World!",
            _ => string.Empty
        };
    }
}

#else
[ApiController]
[Route("[controller]")]
public class HelloController : ControllerBase
{
    private readonly FbClient _client;

    public HelloController(FbClient client)
    {
        _client = client;
    }

    [HttpGet]
    public string HelloWorld()
    {
        return "你好世界！";
    }
}

#endif