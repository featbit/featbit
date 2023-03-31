using System.Text;
using Microsoft.AspNetCore.JsonPatch.Operations;
using Microsoft.AspNetCore.Mvc.Formatters;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;
using Newtonsoft.Json;

namespace Api.Setup;

public class ConfigureMvcOptions : IConfigureOptions<MvcOptions>
{
    public void Configure(MvcOptions options)
    {
        options.OutputFormatters.Insert(0, new JsonPatchDocumentOutputFormatter());
    }
}

internal class JsonPatchDocumentOutputFormatter : TextOutputFormatter
{
    public JsonPatchDocumentOutputFormatter()
    {
        SupportedEncodings.Add(Encoding.UTF8);
        SupportedMediaTypes.Add(MediaTypeHeaderValue.Parse("application/json"));
    }

    protected override bool CanWriteType(Type? type)
    {
        var isOperations =
            typeof(Operation).IsAssignableFrom(type) ||
            typeof(IEnumerable<Operation>).IsAssignableFrom(type);

        return isOperations;
    }

    public override async Task WriteResponseBodyAsync(OutputFormatterWriteContext context, Encoding selectedEncoding)
    {
        var httpContext = context.HttpContext;

        var json = JsonConvert.SerializeObject(context.Object);
        await httpContext.Response.WriteAsync(json, selectedEncoding);
    }
}