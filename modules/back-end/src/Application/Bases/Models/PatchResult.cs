namespace Application.Bases.Models;

public class PatchResult
{
    public bool Success { get; set; }

    public string Message { get; set; }

    public static PatchResult Ok()
    {
        var ok = new PatchResult
        {
            Success = true,
            Message = string.Empty
        };

        return ok;
    }

    public static PatchResult Fail(string error)
    {
        var failed = new PatchResult
        {
            Success = false,
            Message = error
        };

        return failed;
    }
}