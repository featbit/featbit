namespace Application.FeatureFlags;

public class CopyToEnvResult
{
    public int CopiedCount { get; set; }

    public IEnumerable<string> Ignored { get; set; }

    public CopyToEnvResult(int copiedCount, IEnumerable<string> ignored)
    {
        CopiedCount = copiedCount;
        Ignored = ignored ?? Array.Empty<string>();
    }
}