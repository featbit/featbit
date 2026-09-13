namespace Streaming.Protocol;

public static class MessageTypes
{
    public const string Ping = "ping";

    /// <summary>
    /// The reply to a <see cref="Ping"/>. Outbound only — it is never a value the server accepts
    /// from the wire, so it appears as a <c>sent_message_size</c> operation but never as a
    /// <c>received_message_size</c> one.
    /// </summary>
    public const string Pong = "pong";

    public const string Echo = "echo";

    public const string DataSync = "data-sync";

    public const string RpAgentStatus = "rp-agent-status";
}