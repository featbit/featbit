using Microsoft.AspNetCore.Authentication;

namespace Api.Authentication;

public static class AuthenticationBuilderExtensions
{
    public static AuthenticationBuilder AddOpenApi(this AuthenticationBuilder builder, string scheme)
    {
        return builder.AddScheme<OpenApiOptions, OpenApiHandler>(scheme, scheme, _ => { });
    }
}