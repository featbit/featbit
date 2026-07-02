using Api.Setup;
using Serilog;

try
{
    // The initial "bootstrap" logger is able to log errors during start-up. It's completely replaced by the
    // logger configured in `AddSerilog()` later, once configuration and dependency-injection have both been
    // set up successfully.
    Log.Logger = new LoggerConfiguration()
        .WriteTo.Console()
        .CreateBootstrapLogger();

    Log.Information("Starting Evaluation Server");

    WebApplication.CreateBuilder(args)
        .RegisterServices()
        .Build()
        .SetupMiddleware()
        .Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

// https://docs.microsoft.com/en-us/aspnet/core/test/integration-tests?view=aspnetcore-6.0#basic-tests-with-the-default-webapplicationfactory
// Make the implicit Program class public so test projects can access it
public partial class Program { }