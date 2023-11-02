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
        DataChange dataChange,
        Guid currentUserId,
        string comment = "",
        string status = FlagDraftStatus.Pending) : base(currentUserId)
    {
        if (!FlagDraftStatus.IsDefined(status))
        {
            throw new ArgumentOutOfRangeException(nameof(status));
        }

        EnvId = envId;
        FlagId = flagId;
        DataChange = dataChange;

        Comment = comment;
        Status = status;
    }

    public void Applied(Guid memberId)
    {
        Status = FlagDraftStatus.Applied;

        MarkAsUpdated(memberId);
    }

    public IEnumerable<FlagInstruction> GetInstructions()
    {
        var previous =
            JsonSerializer.Deserialize<FeatureFlag>(DataChange.Previous, ReusableJsonSerializerOptions.Web);
        var current =
            JsonSerializer.Deserialize<FeatureFlag>(DataChange.Current, ReusableJsonSerializerOptions.Web);

        return FlagComparer.Compare(previous, current);
    }

    public bool IsApplied() => Status == FlagDraftStatus.Applied;
}