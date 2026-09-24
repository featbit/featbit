using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Api.Setup.OpenApi;

public sealed class HeaderParametersTransformer : IOpenApiOperationTransformer
{
    public Task TransformAsync(
        OpenApiOperation operation, OpenApiOperationTransformerContext context, CancellationToken cancellationToken)
    {
        operation.Parameters ??= (List<IOpenApiParameter>)[];

        operation.Parameters.Add(HeaderParameter(
            ApiConstants.OrgIdHeaderKey,
            "The organization ID associated with the request. Some APIs require this header to identify the organization context. " +
            "When authenticating with an Access Token, this header is automatically populated from the token and does not need to be provided manually."
        ));

        operation.Parameters.Add(HeaderParameter(
            ApiConstants.WorkspaceHeaderKey,
            "The workspace ID associated with the request. Some APIs require this header to identify the workspace context. " +
            "When authenticating with an Access Token, this header is automatically populated from the token and does not need to be provided manually."
        ));

        return Task.CompletedTask;
    }

    private static OpenApiParameter HeaderParameter(string name, string description) => new()
    {
        Name = name,
        In = ParameterLocation.Header,
        Required = false,
        Schema = new OpenApiSchema { Type = JsonSchemaType.String },
        Description = description
    };
}
