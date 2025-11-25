using Application.Bases;
using Domain.Organizations;

namespace Application.Organizations;

public class UpdateOrganization : IRequest<OrganizationVm>
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public OrganizationPermissions DefaultPermissions { get; set; }

    public OrganizationSetting Settings { get; set; }
}

public class UpdateOrganizationValidator : AbstractValidator<UpdateOrganization>
{
    public UpdateOrganizationValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));

        RuleFor(x => x.DefaultPermissions)
            .NotNull().WithErrorCode(ErrorCodes.Required("defaultPermissions"))
            .Must(x => x.IsValid()).WithErrorCode(ErrorCodes.Invalid("defaultPermissions"));
        
        RuleFor(x => x.DefaultPermissions)
            .NotNull().WithErrorCode(ErrorCodes.Required("settings"))
            .Must(x => x.IsValid()).WithErrorCode(ErrorCodes.Invalid("settings"));
    }
}

public class UpdateOrganizationHandler : IRequestHandler<UpdateOrganization, OrganizationVm>
{
    private readonly IOrganizationService _service;
    private readonly IMapper _mapper;

    public UpdateOrganizationHandler(IOrganizationService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<OrganizationVm> Handle(UpdateOrganization request, CancellationToken cancellationToken)
    {
        var organization = await _service.GetAsync(request.Id);

        organization.Update(request.Name, request.Settings, request.DefaultPermissions);

        await _service.UpdateAsync(organization);

        return _mapper.Map<OrganizationVm>(organization);
    }
}