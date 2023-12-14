using System.Text.Json;
using Domain.Utils;
using HandlebarsDotNet;
using Infrastructure.Webhooks;

namespace Application.UnitTests.HandlebarTemplate;

public class HandlebarsTests
{
    public HandlebarsTests()
    {
        HandlebarsHelpers.RegisterHelpers();
    }

    [Theory]
    [InlineData("{{#eq Int 1}}true{{else}}false{{/eq}}", "true")]
    [InlineData("{{#eq String \"1\"}}true{{else}}false{{/eq}}", "true")]
    [InlineData("{{#eq String 1}}true{{else}}false{{/eq}}", "false")]
    public void EqHelper(string template, string expected)
    {
        var data = new
        {
            Int = 1,
            String = "1"
        };

        var result = Handlebars.Compile(template).Invoke(data);
        Assert.Equal(expected, result);
    }

    [Fact]
    public void JsonHelper()
    {
        var data = new
        {
            Id = "id",
            Tags = new[] { "tag1", "tag2" },
            Class2 = new[]
            {
                new
                {
                    Value = "value1",
                    Tags = new[] { "tag1", "tag2" }
                },
                new
                {
                    Value = "value2",
                    Tags = new[] { "tag1", "tag2" }
                }
            }
        };

        const string template = "{{json this}}";
        var actual = Handlebars.Compile(template).Invoke(data);
        var expected = JsonSerializer.Serialize(data, ReusableJsonSerializerOptions.Web);
        Assert.Equal(expected, actual);
    }
}