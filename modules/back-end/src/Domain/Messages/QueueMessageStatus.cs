namespace Domain.Messages;

public static class QueueMessageStatus
{
    public const string Pending = "Pending";
    public const string Processing = "Processing";
    public const string Completed = "Completed";
    public const string Failed = "Failed";

    // special status for notification messages
    public const string Notified = "Notified";
}