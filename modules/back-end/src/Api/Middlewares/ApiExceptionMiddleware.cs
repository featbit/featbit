using Application.Bases.Exceptions;

namespace Api.Middlewares;

public class ApiExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ApiExceptionMiddleware> _logger;

    public ApiExceptionMiddleware(RequestDelegate next, ILogger<ApiExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            var request = context.Request;

            var url = $"{request.Scheme}://{request.Host}{request.PathBase}{request.Path}{request.QueryString}";
            _logger.LogError(ex, "{Method} {Path}: {Message}", request.Method, url, ex.Message);

            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        if (exception is RequestValidationException validationException)
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            var response = validationException.ToResponse();
            await context.Response.WriteAsJsonAsync(response);
            
            return;
        }

        context.Response.StatusCode = 500;
    }
}