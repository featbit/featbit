using Api.Controllers;
using Application.Bases;
using Application.Bases.Exceptions;
using Microsoft.AspNetCore.Diagnostics;

namespace Api.Middlewares;

public static class ApiExceptionMiddlewareExtension
{
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

        // validation exception
        if (ex is ValidationException validationException)
        {
            httpResponse.StatusCode = StatusCodes.Status400BadRequest;

            var errors = validationException.Errors.Select(x => x.ErrorCode);
            var validationError = ApiResponse<object>.Error(errors);
            await httpResponse.WriteAsJsonAsync(validationError);

            return;
        }

        // EntityNotFound exception
        if (ex is EntityNotFoundException)
        {
            httpResponse.StatusCode = StatusCodes.Status404NotFound;

            var entityNotFoundError = ApiResponse<object>.Error(ErrorCodes.ResourceNotFound);
            await httpResponse.WriteAsJsonAsync(entityNotFoundError);

            return;
        }

        // Conflict exception
        if (ex is ConflictException)
        {
            httpResponse.StatusCode = StatusCodes.Status409Conflict;

            var conflictError = ApiResponse<object>.Error(ErrorCodes.Conflict);
            await httpResponse.WriteAsJsonAsync(conflictError);

            return;
        }

        // BusinessException
        if (ex is BusinessException businessException)
        {
            httpResponse.StatusCode = StatusCodes.Status422UnprocessableEntity;

            var businessError = ApiResponse<object>.Error(businessException.Message);
            await httpResponse.WriteAsJsonAsync(businessError);

            return;
        }

        // other exception
        httpResponse.StatusCode = StatusCodes.Status500InternalServerError;
        var error = ApiResponse<object>.Error(ErrorCodes.InternalServerError);
        await httpResponse.WriteAsJsonAsync(error);
    }
}