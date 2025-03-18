namespace Domain.Messages;

public class QueueMessage
{
    public long Id { get; set; }

    public string Topic { get; set; }

    public string Status { get; set; }

    public DateTime EnqueuedAt { get; set; }

    // ensure exactly once delivery within a visibility period
    public DateTime? NotVisibleUntil { get; set; }

    public DateTime? LastDeliverAt { get; set; }

    public DateTime? LastHandledAt { get; set; }

    public int DeliverCount { get; set; }

    public string Payload { get; set; }

    public string Error { get; set; }
}