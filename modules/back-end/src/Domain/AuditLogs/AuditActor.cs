#nullable enable annotations

namespace Domain.AuditLogs;

public class AuditActor
{
    public Guid Id { get; set; }
    public string Type { get; set; }
    public string Name { get; set; }
    public string? Email { get; set; }
}
