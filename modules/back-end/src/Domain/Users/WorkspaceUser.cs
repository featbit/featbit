namespace Domain.Users;

public class WorkspaceUser : AuditedEntity
{
    public Guid WorkspaceId { get; set; }

    public Guid UserId { get; set; }

    public WorkspaceUser(
        Guid workspaceId,
        Guid userId)
    {
        WorkspaceId = workspaceId;
        UserId = userId;
    }
}