using FeatBit.TestApp.Services;

var builder = WebApplication.CreateBuilder(args);

// Bind environment variables to configuration
builder.Configuration.AddEnvironmentVariables();

// Configure Kestrel port from TEST_APP_PORT (default 8080)
var port = builder.Configuration["TEST_APP_PORT"] ?? "8080";
builder.WebHost.UseUrls($"http://*:{port}");

// Register services
builder.Services.AddSingleton<EventTracker>();
builder.Services.AddSingleton<FeatBitClientManager>();
builder.Services.AddControllers();

var app = builder.Build();

app.MapControllers();

app.Run();
