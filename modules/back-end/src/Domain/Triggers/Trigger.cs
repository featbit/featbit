#nullable enable

using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Users;

namespace Domain.Triggers;

public class Trigger : AuditedEntity
{
    public Guid TargetId { get; set; }

    public string Type { get; set; }

    public string Action { get; set; }

    public string Token { get; set; }

    public string Description { get; set; }

    public bool IsEnabled { get; set; }

    public int TriggeredTimes { get; set; }

    public DateTime? LastTriggeredAt { get; set; }

    public Trigger(Guid id, Guid targetId, string type, string action, string? description)
    {
        Id = id;

        TargetId = targetId;
        Type = type;
        Action = action;
        Token = TokenHelper.New(Id);
        Description = description ?? string.Empty;
        IsEnabled = true;

        TriggeredTimes = 0;
        LastTriggeredAt = null;
    }

    public void ResetToken()
    {
        Token = TokenHelper.New(Id);

        UpdatedAt = DateTime.UtcNow;
    }

    public static bool TryParseToken(string token, out Guid id)
    {
        id = Guid.Empty;
        if (token.Length != 40)
        {
            return false;
        }

        id = GuidHelper.Decode(token.Substring(18, 22));
        return true;
    }

    public DataChange? Run(FeatureFlag featureFlag)
    {
        if (!IsEnabled)
        {
            return null;
        }

        switch (featureFlag.IsEnabled)
        {
            case true when Action == TriggerActions.TurnOn:
            case false when Action == TriggerActions.TurnOff:
                return null;
        }

        var dataChange = new DataChange(featureFlag);
        featureFlag.Toggle(SystemUser.Id);

        TriggeredTimes++;
        LastTriggeredAt = DateTime.UtcNow;

        return dataChange.To(featureFlag);
    }

    public void Update(bool isEnabled)
    {
        IsEnabled = isEnabled;

        UpdatedAt = DateTime.UtcNow;
    }
}