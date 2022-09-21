namespace Api.Controllers;

public record ApiResponse
{
    public bool Success { get; set; }

    public IEnumerable<string> Errors { get; set; } = Array.Empty<string>();

    public object? Data { get; set; }

    public static ApiResponse Ok(object? data)
    {
        return new ApiResponse
        {
            Success = true,
            Errors = Array.Empty<string>(),
            Data = data
        };
    }

    public static ApiResponse Error(IEnumerable<string> errors)
    {
        return new ApiResponse
        {
            Success = false,
            Errors = errors,
            Data = null
        };
    }

    public static ApiResponse Error(string error) => Error(new[] { error });
}