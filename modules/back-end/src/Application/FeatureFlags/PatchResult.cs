namespace Application.FeatureFlags;

public class PatchResult
{
    public bool Success { get; set; }

    public string Message { get; set; }

    public PatchResult()
    {
        Success = true;
    }
}