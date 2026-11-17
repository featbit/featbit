#nullable enable

using Domain.Policies;

namespace Domain.AuditLogs;

public record IamAuditReference(Guid Id, string Name, string Rn);
public record PolicyAuditReference(Guid Id, string Name, string Rn, string Type) : IamAuditReference(Id, Name, Rn);
public abstract record IamAuditSnapshot(Guid Id, string Name, string Rn);
public record ProfileAuditSnapshot(Guid Id, string Name, string Rn, string? Email) : IamAuditSnapshot(Id, Name, Rn);
public record MemberAuditSnapshot(Guid Id, string Name, string Rn, string? Email,
    IamAuditReference[] Groups, PolicyAuditReference[] Policies) : IamAuditSnapshot(Id, Name, Rn);
public record GroupAuditSnapshot(Guid Id, string Name, string Rn, string? Description,
    IamAuditReference[] Members, PolicyAuditReference[] Policies) : IamAuditSnapshot(Id, Name, Rn);
public record PolicyAuditSnapshot(Guid Id, string Name, string Rn, string? Description,
    PolicyStatement[] Statements, IamAuditReference[] Members, IamAuditReference[] Groups) : IamAuditSnapshot(Id, Name, Rn);
