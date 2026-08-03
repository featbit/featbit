using Api.Setup;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .CreateBootstrapLogger();

WebApplication.CreateBuilder(args).RegisterServices().Build().SetupMiddleware().Run();