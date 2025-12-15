#nullable enable

using Application.Users;
using Domain.AuditLogs;
using Domain.Users;

namespace Application.AuditLogs;

public class LastChangeVm
{
    public UserVm Operator { get; set; }

    public DateTime HappenedAt { get; set; }

    public string Comment { get; set; }

    public LastChangeVm(LastChange lastChange, User? user)
    {
        Operator = new UserVm
        {
            Id = user?.Id ?? Guid.Empty,
            Name = user?.Name ?? "Ghost",
            Email = user?.Email ?? "Ghost"
        };
        HappenedAt = lastChange.HappenedAt;
        Comment = lastChange.Comment;
    }
}