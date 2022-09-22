namespace Api.Controllers;

public record ApiResponse<TData>
{
    public bool Success { get; set; }

    public IEnumerable<string> Errors { get; set; } = Array.Empty<string>();

    public TData? Data { get; set; }

    public static ApiResponse<TData> Ok(TData? data)
    {
        return new ApiResponse<TData>
        {
            Success = true,
            Errors = Array.Empty<string>(),
            Data = data
        };
    }

    public static ApiResponse<TData> Error(IEnumerable<string> errors)
    {
        return new ApiResponse<TData>
        {
            Success = false,
            Errors = errors,
            Data = default
        };
    }

    public static ApiResponse<TData> Error(string error) => Error(new[] { error });
}