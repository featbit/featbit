using Domain.AuditLogs;
using Application.Users;
using Application.Bases.Models;
using Microsoft.AspNetCore.JsonPatch;

namespace Application.FeatureFlags;

public class PatchFeatureFlag : IRequest<PatchResult>
{
    public Guid EnvId { get; set; }

    public string Key { get; set; }

    public JsonPatchDocument Patch { get; set; }
}

public class PatchFeatureFlagHandler : IRequestHandler<PatchFeatureFlag, PatchResult>
{
    private readonly IFeatureFlagService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IPublisher _publisher;
    private readonly IAuditLogService _auditLogService;

    public PatchFeatureFlagHandler(
        IFeatureFlagService service,
        ICurrentUser currentUser,
        IPublisher publisher,
        IAuditLogService auditLogService)
    {
        _service = service;
        _currentUser = currentUser;
        _publisher = publisher;
        _auditLogService = auditLogService;
    }

    public async Task<PatchResult> Handle(PatchFeatureFlag request, CancellationToken cancellationToken)
    {
        var flag = await _service.GetAsync(request.EnvId, request.Key);
        var dataChange = new DataChange(flag);

        var error = string.Empty;
        request.Patch.ApplyTo(flag, jsonPatchError => error = jsonPatchError.ErrorMessage);

        if (!string.IsNullOrWhiteSpace(error))
        {
            return PatchResult.Fail(error);
        }

        flag.UpdatorId = _currentUser.Id;
        flag.UpdatedAt = DateTime.UtcNow;

        dataChange.To(flag);
        await _service.UpdateAsync(flag);

        // write audit log
        var auditLog = AuditLog.ForUpdate(flag, dataChange, string.Empty, _currentUser.Id);
        await _auditLogService.AddOneAsync(auditLog);

        // publish on feature flag change notification
        await _publisher.Publish(new OnFeatureFlagChanged(flag), cancellationToken);

        return PatchResult.Ok();
    }
}