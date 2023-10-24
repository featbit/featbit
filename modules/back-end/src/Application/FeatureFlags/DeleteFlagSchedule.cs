using Application.Bases;
using Application.Bases.Exceptions;
using Domain.Organizations;

namespace Application.FeatureFlags;

public class DeleteFlagSchedule : IRequest<bool>
{
    public Guid OrgId { get; set; }
    public Guid Id { get; set; }
}

public class DeleteFlagScheduleHandler : IRequestHandler<DeleteFlagSchedule, bool>
{
    private readonly IFlagScheduleService _service;
    private readonly ILicenseService _licenseService;
    private readonly IFlagChangeRequestService _flagChangeRequestService;

    public DeleteFlagScheduleHandler(
        IFlagScheduleService service,
        ILicenseService licenseService,
        IFlagChangeRequestService flagChangeRequestService)
    {
        _service = service;
        _licenseService = licenseService;
        _flagChangeRequestService = flagChangeRequestService;
    }

    public async Task<bool> Handle(DeleteFlagSchedule request, CancellationToken cancellationToken)
    {
        var schedule = await _service.GetAsync(request.Id);
        if (schedule == null)
        {
            return true;
        }

        if (schedule.ChangeRequestId.HasValue)
        {
            var isChangeRequestGranted =
                await _licenseService.IsFeatureGrantedAsync(request.OrgId, LicenseFeatures.ChangeRequest);

            if (!isChangeRequestGranted)
            {
                throw new BusinessException(ErrorCodes.Unauthorized);
            }
        }

        await _service.DeleteAsync(schedule.Id);

        if (!schedule.ChangeRequestId.HasValue)
        {
            return true;
        }
        
        var changeRequest = await _flagChangeRequestService.GetAsync(schedule.ChangeRequestId.Value);
        if (changeRequest != null)
        {
            await _flagChangeRequestService.DeleteAsync(changeRequest.Id);
        }

        return true;
    }
}