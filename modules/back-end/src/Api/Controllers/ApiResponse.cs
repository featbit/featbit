namespace Api.Controllers;

public record ApiResponse
{
    public bool Success { get; set; }

    public string Message { get; set; } = string.Empty;

    public object? Data { get; set; }

    public static ApiResponse Ok(object? data)
    {
        return new ApiResponse
        {
            Success = true,
            Message = string.Empty,
            Data = data
        };
    }

    public static ApiResponse Error(string error)
    {
        return new ApiResponse
        {
            Success = false,
            Message = error,
            Data = null
        };
    }
}