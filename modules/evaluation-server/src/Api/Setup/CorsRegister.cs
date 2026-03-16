using System.ComponentModel.DataAnnotations;
using Api.Cors;

namespace Api.Setup;

public static class CorsRegister
{
    public static WebApplicationBuilder AddCorsPolicy(this WebApplicationBuilder builder)
    {
        var services = builder.Services;
        var configuration = builder.Configuration;

        var corsOptions = new CorsOptions();
        configuration.GetSection(CorsOptions.Cors).Bind(corsOptions);
        Validator.ValidateObject(corsOptions, new ValidationContext(corsOptions), validateAllProperties: true);

        services.AddOptionsWithValidateOnStart<CorsOptions>()
            .Bind(configuration.GetSection(CorsOptions.Cors))
            .ValidateDataAnnotations();

        if (!corsOptions.Enabled)
        {
            return builder;
        }

        services.AddCors(options => options.AddDefaultPolicy(policyBuilder =>
        {
            // origins
            if (corsOptions.AllowAnyOrigins)
                policyBuilder.AllowAnyOrigin();
            else
                policyBuilder.WithOrigins(corsOptions.Origins);

            // headers
            if (corsOptions.AllowAnyHeaders)
                policyBuilder.AllowAnyHeader();
            else
                policyBuilder.WithHeaders(corsOptions.Headers);

            // methods
            if (corsOptions.AllowAnyMethods)
                policyBuilder.AllowAnyMethod();
            else
                policyBuilder.WithMethods(corsOptions.Methods);

            // credentials
            if (corsOptions.AllowCredentials)
                policyBuilder.AllowCredentials();
            else
                policyBuilder.DisallowCredentials();
        }));

        return builder;
    }
}
