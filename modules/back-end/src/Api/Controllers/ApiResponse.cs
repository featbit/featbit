namespace Api.Controllers;

/// <summary>
/// Represents the response of an API call.
/// </summary>
/// <typeparam name="TData">The type of the data returned by the API call.</typeparam>
public record ApiResponse<TData>
{
    /// <summary>
    /// Indicating whether the API call was successful.
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// A collection of error messages returned by the API call.
    /// </summary>
    public IEnumerable<string> Errors { get; set; } = Array.Empty<string>();

    /// <summary>
    /// The data returned by the API call.
    /// </summary>
    public TData? Data { get; set; }

    /// <summary>
    /// Creates a new instance of the <see cref="ApiResponse{TData}"/> class with a successful result.
    /// </summary>
    /// <param name="data">The data returned by the API call.</param>
    /// <returns>A new instance of the <see cref="ApiResponse{TData}"/> class with a successful result.</returns>
    public static ApiResponse<TData> Ok(TData? data)
    {
        return new ApiResponse<TData>
        {
            Success = true,
            Errors = Array.Empty<string>(),
            Data = data
        };
    }

    /// <summary>
    /// Creates a new instance of the <see cref="ApiResponse{TData}"/> class with an error result.
    /// </summary>
    /// <param name="errors">The collection of error messages returned by the API call.</param>
    /// <returns>A new instance of the <see cref="ApiResponse{TData}"/> class with an error result.</returns>
    public static ApiResponse<TData> Error(IEnumerable<string> errors)
    {
        return new ApiResponse<TData>
        {
            Success = false,
            Errors = errors,
            Data = default
        };
    }

    /// <summary>
    /// Creates a new instance of the <see cref="ApiResponse{TData}"/> class with an error result.
    /// </summary>
    /// <param name="error">The error message returned by the API call.</param>
    /// <returns>A new instance of the <see cref="ApiResponse{TData}"/> class with an error result.</returns>
    public static ApiResponse<TData> Error(string error) => Error([error]);
}