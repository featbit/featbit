using Domain.AuditLogs;

namespace Application.AuditLogs;

public class AuditLogActorsVm
{
    public IReadOnlyList<AuditActor> Items { get; set; } = [];
}
