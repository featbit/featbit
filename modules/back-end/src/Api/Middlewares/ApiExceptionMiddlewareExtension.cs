using Api.Controllers;
using Application.Bases;
using Application.Bases.Exceptions;
using Microsoft.AspNetCore.Diagnostics;

namespace Api.Middlewares;

public static partial class ApiExceptionMiddlewareExtension
{
    private const string LoggerCategory = "Api.Middlewares.ApiExceptionMiddleware";

    public static IApplicationBuilder UseApiExceptionHandler(this IApplicationBuilder builder)
    {
        return builder.UseExceptionHandler(app =>
        {
            app.Run(async context => await HandleExceptionAsync(context));
        });
    }

    private static async Task HandleExceptionAsync(HttpContext context)
    {
        var exceptionFeature = context.Features.Get<IExceptionHandlerFeature>();
        if (exceptionFeature == null)
        {
            return;
        }

        var httpResponse = context.Response;
        var ex = exceptionFeature.Error;

        // Observability: this handler previously swallowed every exception silently, so a 500 left
        // no trace of its cause anywhere. Logging is added here only — status codes and response
        // bodies are an API contract and are unchanged (docs/observability/index.md §6).
        // The path is logged without its query string, which can carry credentials (§7).
        var logger = context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger(LoggerCategory);
        var path = context.Request.Path.Value ?? string.Empty;

        // validation exception
        if (ex is ValidationException validationException)
        {
            httpResponse.StatusCode = StatusCodes.Status400BadRequest;

            var errors = validationException.Errors.Select(x => x.ErrorCode);
            var validationError = ApiResponse<object>.Error(errors);
            Log.RequestValidationFailed(logger, context.Request.Method, path, string.Join(',', errors));
            await httpResponse.WriteAsJsonAsync(validationError);

            return;
        }

        // EntityNotFound exception
        if (ex is EntityNotFoundException)
        {
            httpResponse.StatusCode = StatusCodes.Status404NotFound;

            var entityNotFoundError = ApiResponse<object>.Error(ErrorCodes.ResourceNotFound);
            Log.RequestFailed(logger, context.Request.Method, path, StatusCodes.Status404NotFound, ex);
            await httpResponse.WriteAsJsonAsync(entityNotFoundError);

            return;
        }

        // Conflict exception
        if (ex is ConflictException)
        {
            httpResponse.StatusCode = StatusCodes.Status409Conflict;

            var conflictError = ApiResponse<object>.Error(ErrorCodes.Conflict);
            Log.RequestFailed(logger, context.Request.Method, path, StatusCodes.Status409Conflict, ex);
            await httpResponse.WriteAsJsonAsync(conflictError);

            return;
        }

        // Forbidden exception
        if (ex is ForbiddenException)
        {
            httpResponse.StatusCode = StatusCodes.Status403Forbidden;

            var forbiddenError = ApiResponse<object>.Error(ErrorCodes.Forbidden);
            Log.RequestFailed(logger, context.Request.Method, path, StatusCodes.Status403Forbidden, ex);
            await httpResponse.WriteAsJsonAsync(forbiddenError);

            return;
        }

        // BusinessException
        if (ex is BusinessException businessException)
        {
            httpResponse.StatusCode = StatusCodes.Status422UnprocessableEntity;

            var businessError = ApiResponse<object>.Error(businessException.Message);
            Log.RequestFailed(logger, context.Request.Method, path, StatusCodes.Status422UnprocessableEntity, ex);
            await httpResponse.WriteAsJsonAsync(businessError);

            return;
        }

        // other exception
        httpResponse.StatusCode = StatusCodes.Status500InternalServerError;
        var error = ApiResponse<object>.Error(ErrorCodes.InternalServerError);
        Log.RequestUnhandledException(logger, context.Request.Method, path, ex);
        await httpResponse.WriteAsJsonAsync(error);
    }

    private static partial class Log
    {
        /// <summary>
        /// An expected, client-caused failure. Logged at Warning because it is actionable for the
        /// caller but is not a server fault; the exception is attached so the stack is available.
        /// </summary>
        [LoggerMessage(1, LogLevel.Warning, "Request {Method} {Path} failed with status {StatusCode}.",
            EventName = "RequestFailed")]
        public static partial void RequestFailed(
            ILogger logger, string method, string path, int statusCode, Exception exception);

        /// <summary>
        /// Validation failures log their error <i>codes</i> only. The offending values are user
        /// input and may be personal data, so they are never logged.
        /// </summary>
        [LoggerMessage(2, LogLevel.Warning, "Request {Method} {Path} failed validation. Errors: {ErrorCodes}",
            EventName = "RequestValidationFailed")]
        public static partial void RequestValidationFailed(
            ILogger logger, string method, string path, string errorCodes);

        /// <summary>An unanticipated server fault — the case that previously produced a silent 500.</summary>
        [LoggerMessage(3, LogLevel.Error, "Unhandled exception processing {Method} {Path}.",
            EventName = "RequestUnhandledException")]
        public static partial void RequestUnhandledException(
            ILogger logger, string method, string path, Exception exception);
    }
}