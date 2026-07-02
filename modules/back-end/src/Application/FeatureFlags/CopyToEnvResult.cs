namespace Application.FeatureFlags;

public class CopyToEnvResult
{
    public int CopiedCount { get; set; }

    public CopyToEnvResult(int copiedCount)
    {
        CopiedCount = copiedCount;
    }
}