using System.Text.Json;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.SemanticPatch;

namespace Domain.FlagDrafts;

public class FlagDraft : FullAuditedEntity
{
    public Guid EnvId { get; set; }

    public Guid FlagId { get; set; }

    public string Status { get; set; }

    public string Comment { get; set; }

    public DataChange DataChange { get; set; }

    public FlagDraft(
        Guid envId,
        Guid flagId,
        string status,
        string comment,
        DataChange dataChange,
        Guid currentUserId) : base(currentUserId)
    {
        if (!FlagDraftStatus.IsDefined(status))
        {
            throw new ArgumentOutOfRangeException(nameof(status));
        }

        EnvId = envId;
        FlagId = flagId;
        Status = status;
        Comment = comment;
        DataChange = dataChange;
    }

    public static FlagDraft Pending(
        Guid envId,
        Guid flagId,
        string comment,
        DataChange dataChange,
        Guid currentUserId)
    {
        return new FlagDraft(envId, flagId, FlagDraftStatus.Pending, comment, dataChange, currentUserId);
    }

    public void Applied()
    {
        Status = FlagDraftStatus.Applied;
        UpdatedAt = DateTime.UtcNow;
    }

    public IEnumerable<FlagInstruction> GetInstructions()
    {
        var previous =
            JsonSerializer.Deserialize<FeatureFlag>(DataChange.Previous, ReusableJsonSerializerOptions.Web);
        var current =
            JsonSerializer.Deserialize<FeatureFlag>(DataChange.Current, ReusableJsonSerializerOptions.Web);

        return FlagComparer.Compare(previous, current);
    }
}