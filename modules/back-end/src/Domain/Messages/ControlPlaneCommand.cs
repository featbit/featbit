#nullable enable

using System.Text.Json.Serialization;

namespace Domain.Messages;

public class ControlPlaneCommand
{
    public Action Action { get; set; }

    public string ConnectionId { get; set; } = "*";

    /// <summary>
    /// Optional data center filter. When non-null, only eval servers whose own DcId
    /// (config "ControlPlane:DcId") equals this value act on the command; all others ignore it.
    /// When null (the default) every DC acts on it — the original broadcast behavior.
    /// </summary>
    public string? TargetDcId { get; set; }
}

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum Action
{
    PushFullSync
}