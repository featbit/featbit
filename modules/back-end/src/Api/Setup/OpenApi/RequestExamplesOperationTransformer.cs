using System.Reflection;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Api.Setup.OpenApi;

public sealed class RequestExamplesOperationTransformer : IOpenApiOperationTransformer
{
    public Task TransformAsync(
        OpenApiOperation operation, OpenApiOperationTransformerContext context, CancellationToken cancellationToken)
    {
        if (context.Description.ActionDescriptor is not ControllerActionDescriptor descriptor)
        {
            return Task.CompletedTask;
        }

        var attribute = descriptor.MethodInfo.GetCustomAttribute<OpenApiRequestExamplesAttribute>();
        if (attribute is null)
        {
            return Task.CompletedTask;
        }

        if (operation.RequestBody?.Content is not { } content ||
            !content.TryGetValue("application/json", out var mediaType))
        {
            return Task.CompletedTask;
        }

        var provider = (IOpenApiExamplesProvider)Activator.CreateInstance(attribute.ProviderType)!;

        mediaType.Examples = provider.GetExamples().ToDictionary(
            example => example.Name,
            example => (IOpenApiExample)new OpenApiExample { Value = JsonSerializer.SerializeToNode(example.Value) }
        );

        return Task.CompletedTask;
    }
}
