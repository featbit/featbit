using System.Text;
using Domain.FeatureFlags;

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

    public Trigger(Guid id, Guid targetId, string type, string action, string description)
    {
        Id = id;

        TargetId = targetId;
        Type = type;
        Action = action;
        Token = NewToken();
        Description = description ?? string.Empty;
        IsEnabled = true;

        TriggeredTimes = 0;
        LastTriggeredAt = null;
    }

    public void ResetToken()
    {
        Token = NewToken();

        UpdatedAt = DateTime.UtcNow;
    }

    private string NewToken()
    {
        // timestamp in millis, length is 13
        var reversedTimestamp =
            new string(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString().Reverse().ToArray());

        // header length is (13 + 2) * 4/3 = 20, we trim '=' character, so got 18 chars
        var header = Convert.ToBase64String(Encoding.UTF8.GetBytes(reversedTimestamp)).TrimEnd('=');

        // 22 chars
        var guid = GuidHelper.Encode(Id);

        // 18 + 22 = 40 chars
        return $"{header}{guid}";
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

    public void Run(FeatureFlag featureFlag)
    {
        switch (Action)
        {
            case TriggerActions.TurnOff:
                featureFlag.IsEnabled = false;
                featureFlag.UpdatedAt = DateTime.UtcNow;
                break;

            case TriggerActions.TurnOn:
                featureFlag.IsEnabled = true;
                featureFlag.UpdatedAt = DateTime.UtcNow;
                break;
        }

        TriggeredTimes++;
        LastTriggeredAt = DateTime.UtcNow;
    }

    public void Update(bool isEnabled, string description)
    {
        IsEnabled = isEnabled;
        Description = description ?? string.Empty;

        UpdatedAt = DateTime.UtcNow;
    }
}