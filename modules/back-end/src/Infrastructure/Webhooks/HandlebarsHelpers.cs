using System.Text.Json;
using Domain.Utils;
using HandlebarsDotNet;

namespace Infrastructure.Webhooks;

public static class HandlebarsHelpers
{
    public static void RegisterHelpers()
    {
        Handlebars.RegisterHelper("eq", EqualHelper);
        Handlebars.RegisterHelper("json", JsonHelper);
    }

    private static readonly HandlebarsBlockHelper EqualHelper = (output, options, context, arguments) =>
    {
        if (arguments.Length != 2)
        {
            throw new HandlebarsException("{{eq}} helper must have exactly two arguments");
        }

        var left = arguments[0];
        var right = arguments[1];
        if (left?.Equals(right) == true)
        {
            options.Template(output, context);
        }
        else
        {
            options.Inverse(output, context);
        }
    };

    private static readonly HandlebarsHelper JsonHelper = (output, _, arguments) =>
    {
        if (arguments.Length != 1)
        {
            throw new HandlebarsException("{{json}} helper must have exactly one argument");
        }

        var value = arguments[0];
        var json = value is null
            ? "null"
            : JsonSerializer.Serialize(value, ReusableJsonSerializerOptions.Web);

        output.WriteSafeString(json);
    };
}