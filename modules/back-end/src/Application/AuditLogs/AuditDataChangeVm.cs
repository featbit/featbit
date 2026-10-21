using Domain.AuditLogs;

namespace Application.AuditLogs;

public class AuditDataChangeVm
{
    public AuditResourceReference ClonedFrom { get; set; }

    public string Previous { get; set; }

    public string Current { get; set; }
}
