using System.Text.RegularExpressions;
using Api.Controllers;
using Application.Bases;

namespace Api.Setup;

public static partial class ModelValidationResponse
{
    public static IActionResult Create(ActionContext context)
    {
        var errors = context.ModelState.Values
            .SelectMany(entry => entry.Errors)
            .Select(error => error.Exception == null && FieldErrorCode().IsMatch(error.ErrorMessage)
                ? error.ErrorMessage
                : ErrorCodes.Invalid("request"))
            .Distinct(StringComparer.Ordinal)
            .ToArray();

        return new BadRequestObjectResult(ApiResponse<object>.Error(
            errors.Length > 0 ? errors : [ErrorCodes.Invalid("request")])
        );
    }

    // Only explicit field error codes are part of the API contract. Framework messages
    // and model-binding exception details must not be returned as error codes.
    [GeneratedRegex(@"\A[a-z][a-zA-Z0-9_.-]*_is_(?:required|invalid)\z", RegexOptions.CultureInvariant)]
    private static partial Regex FieldErrorCode();
}
