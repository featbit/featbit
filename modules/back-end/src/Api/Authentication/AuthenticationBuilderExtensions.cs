using System.Text;
using Application;
using Application.Services;
using Domain.Policies;
using Domain.Users;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Primitives;
using Microsoft.IdentityModel.Tokens;

namespace Api.Authentication;

public static class AuthenticationBuilderExtensions
{
    public static AuthenticationBuilder AddOpenApi(this AuthenticationBuilder builder)
    {
        return builder.AddScheme<OpenApiOptions, OpenApiHandler>(Schemes.OpenApi, Schemes.OpenApi, _ => { });
    }

    public static AuthenticationBuilder AddJwtBearer(
        this AuthenticationBuilder builder,
        IConfigurationSection jwtConfigSection)
    {
        return builder.AddJwtBearer(Schemes.JwtBearer, options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                AuthenticationType = Schemes.JwtBearer,

                ValidateIssuer = true,
                ValidIssuer = jwtConfigSection["Issuer"],

                ValidateAudience = true,
                ValidAudience = jwtConfigSection["Audience"],

                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtConfigSection["Key"]!))
            };

            options.Events = new JwtBearerEvents
            {
                OnTokenValidated = EventsOnTokenValidated
            };
        });

        async Task EventsOnTokenValidated(TokenValidatedContext context)
        {
            var httpContext = context.HttpContext;

            // Only when the endpoint has `Authorize` attribute with permissions defined,
            // we will try to get user permissions and put it into `HttpContext.Items` for later use.
            var endpoint = httpContext.GetEndpoint();
            if (endpoint == null ||
                endpoint.Metadata.OfType<AuthorizeAttribute>().All(x => !Permissions.All.Contains(x.Policy)))
            {
                return;
            }

            var orgIdHeaderValue = httpContext.Request.Headers[ApiConstants.OrgIdHeaderKey];
            if (orgIdHeaderValue == StringValues.Empty)
            {
                // We haven't got organization id yet, return empty permissions and let the request pass.
                httpContext.Items[ApplicationConsts.UserPermissionsItem] = Array.Empty<PolicyStatement>();
                return;
            }

            if (!Guid.TryParse(orgIdHeaderValue, out var orgId))
            {
                context.Fail("Malformed organization id.");
                return;
            }

            var userIdClaim = context.Principal?.Claims.FirstOrDefault(x => x.Type == UserClaims.Id);
            if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
            {
                context.Fail("Malformed token.");
                return;
            }

            var memberService = httpContext.RequestServices.GetRequiredService<IMemberService>();

            var statements = await memberService.GetPermissionsAsync(orgId, userId);
            httpContext.Items[ApplicationConsts.UserPermissionsItem] = statements;
        }
    }
}