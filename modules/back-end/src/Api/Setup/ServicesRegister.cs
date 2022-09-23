using Microsoft.Extensions.Options;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace Api.Setup;

public static class ServicesRegister
{
    public static WebApplicationBuilder RegisterServices(this WebApplicationBuilder builder)
    {
        // add services for controllers
        builder.Services.AddControllers();

        // make all generated paths URLs are lowercase
        builder.Services.Configure<RouteOptions>(options => options.LowercaseUrls = true);

        // api versioning
        builder.Services
            .AddApiVersioning(options => options.ReportApiVersions = true)
            .AddMvc()
            .AddApiExplorer(options =>
            {
                // add the versioned api explorer, which also adds IApiVersionDescriptionProvider service
                // note: the specified format code will format the version as "'v'major[.minor][-status]"
                options.GroupNameFormat = "'v'VVV";

                // note: this option is only necessary when versioning by url segment. the SubstitutionFormat
                // can also be used to control the format of the API version in route templates
                options.SubstituteApiVersionInUrl = true;
            });
        
        // cors
        var allowedOrigins = builder.Configuration["Cors:AllowedOrigins"].Split(',');
        builder.Services.AddCors(options => options.AddDefaultPolicy(policyBuilder =>
        {
            policyBuilder
                .WithOrigins(allowedOrigins)
                .AllowAnyHeader()
                .AllowAnyMethod();
        }));

        // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
        builder.Services.AddTransient<IConfigureOptions<SwaggerGenOptions>, ConfigureSwaggerOptions>();
        builder.Services.AddSwaggerGen();

        // health check dependencies
        builder.Services.AddHealthChecks();

        // add infrastructure & application services
        builder.Services.AddInfrastructureServices(builder.Configuration);
        builder.Services.AddApplicationServices();

        return builder;
    }
}