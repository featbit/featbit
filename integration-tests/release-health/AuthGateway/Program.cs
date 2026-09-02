using System.Security.Cryptography;
using System.Text;
var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 16384);
// This is a localhost-only test fixture, not a production authentication service.
builder.Logging.ClearProviders();
var secret = File.ReadAllText("/run/secrets/provider-token").Trim();
var password = File.ReadAllText("/run/secrets/provider-password").Trim();
using var client = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { Timeout = TimeSpan.FromSeconds(15) };
var app = builder.Build();
app.MapGet("/health", () => Results.Ok());
app.MapMethods("/{mode}/api/v1/{operation}", ["GET", "POST"], async (string mode, string operation, HttpContext context) =>
{
    if (operation is not ("query" or "query_range")) { context.Response.StatusCode = 404; return; }
    var expected = mode switch
    {
        "none" => "",
        "bearer" => "Bearer " + secret,
        "basic" => "Basic " + Convert.ToBase64String(Encoding.UTF8.GetBytes("metrics-reader:" + password)),
        _ => null
    };
    if (expected is null) { context.Response.StatusCode = 404; return; }
    var received = context.Request.Headers.Authorization.ToString();
    if (!CryptographicOperations.FixedTimeEquals(SHA256.HashData(Encoding.UTF8.GetBytes(expected)), SHA256.HashData(Encoding.UTF8.GetBytes(received))))
    { context.Response.StatusCode = 401; return; }
    try
    {
        using var request = new HttpRequestMessage(new HttpMethod(context.Request.Method), "http://prometheus:9090/api/v1/" + operation + context.Request.QueryString);
        if (context.Request.Method == "POST")
        {
            if (!context.Request.HasFormContentType) { context.Response.StatusCode = 415; return; }
            var form = await context.Request.ReadFormAsync(context.RequestAborted);
            request.Content = new FormUrlEncodedContent(form.Select(x => new KeyValuePair<string, string>(x.Key, x.Value.ToString())));
        }
        using var response = await client.SendAsync(request, context.RequestAborted);
        context.Response.StatusCode = (int)response.StatusCode;
        context.Response.ContentType = "application/json";
        await response.Content.CopyToAsync(context.Response.Body, context.RequestAborted);
    }
    catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
    { context.Response.StatusCode = 502; }
});
app.Run();
