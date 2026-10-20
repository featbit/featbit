using Domain.SemanticPatch;

namespace Application.AuditLogs;

public class AuditLogVm
{
    public Guid? OrganizationId { get; set; }
    public Guid? EnvId { get; set; }
    public string Id { get; set; }

    public string RefId { get; set; }

    public string RefType { get; set; }

    public string Operation { get; set; }

    public AuditDataChangeVm DataChange { get; set; }

    public string Comment { get; set; }

    public Guid CreatorId { get; set; }

    public string CreatorName { get; set; }

    public string CreatorEmail { get; set; }

    public DateTime CreatedAt { get; set; }

    public IEnumerable<Instruction> Instructions { get; set; }
}
