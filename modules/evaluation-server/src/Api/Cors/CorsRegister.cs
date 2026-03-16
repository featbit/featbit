namespace Api.Cors;

public static class CorsRegister
{
    public static WebApplicationBuilder AddCorsPolicy(this WebApplicationBuilder builder)
    {
        var services = builder.Services;
        var configuration = builder.Configuration;

        var corsOptions = new CorsOptions();
        configuration.GetSection(CorsOptions.Cors).Bind(corsOptions);

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
                policyBuilder.WithOrigins(corsOptions.ParsedOrigins);

            // headers
            if (corsOptions.AllowAnyHeaders)
                policyBuilder.AllowAnyHeader();
            else
                policyBuilder.WithHeaders(corsOptions.ParsedHeaders);

            // methods
            if (corsOptions.AllowAnyMethods)
                policyBuilder.AllowAnyMethod();
            else
                policyBuilder.WithMethods(corsOptions.ParsedMethods);

            // credentials
            if (corsOptions.AllowCredentials)
                policyBuilder.AllowCredentials();
        }));

        return builder;
    }
}
