using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Api.Swagger
{
    public class OrganizationHeaderParameter : IOperationFilter
    {
        public void Apply(OpenApiOperation operation, OperationFilterContext context)
        {
            operation.Parameters.Add(new OpenApiParameter
            {
                Name = ApiConstants.OrgIdHeaderKey,
                In = ParameterLocation.Header,
                Required = false,
                Schema = new OpenApiSchema
                {
                    Type = "string"
                },
                Description =
                    "The organization ID associated with the request. Some APIs require this header to identify the organization context. " +
                    "When authenticating with an Access Token, this header is automatically populated from the token and does not need to be provided manually."
            });
        }
    }
}