using Api.Controllers;
using Application.Bases;

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

    private static async Task HandleExceptionAsync(HttpContext context, Exception ex)
    {
        var httpResponse = context.Response;

        // validation exception
        if (ex is ValidationException validationException)
        {
            httpResponse.StatusCode = StatusCodes.Status400BadRequest;

            var errors = validationException.Errors.Select(x => x.ErrorCode);
            var validationError = ApiResponse.Error(errors);
            await httpResponse.WriteAsJsonAsync(validationError);

            return;
        }

        // other exception
        httpResponse.StatusCode = StatusCodes.Status500InternalServerError;
        var error = ApiResponse.Error(ErrorCodes.InternalServerError);
        await httpResponse.WriteAsJsonAsync(error);
    }
}