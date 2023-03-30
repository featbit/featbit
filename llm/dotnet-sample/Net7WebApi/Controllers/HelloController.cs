using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using Microsoft.AspNetCore.Mvc;

namespace Net7WebApi.Controllers;

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
        var user = FbUser.Builder("guid-string").Name("bob").Build();

        var variation = _client.StringVariation("language", user, "en-us");
        return variation switch
        {
            "zh-cn" => "你好世界！",
            "en-us" => "Hello World!",
            _ => string.Empty
        };
    }
}