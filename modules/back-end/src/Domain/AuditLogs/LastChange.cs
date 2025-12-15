namespace Domain.AuditLogs;

public class LastChange
{
    public string RefId { get; set; }

    public Guid OperatorId { get; set; }

    public DateTime HappenedAt { get; set; }

    public string Comment { get; set; }
}