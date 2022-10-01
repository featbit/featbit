using Application.Bases;

namespace Application.Organizations;

public class UpdateOrganization : IRequest<OrganizationVm>
{
    public Guid Id { get; set; }

    public string Name { get; set; }
}

public class UpdateOrganizationValidator : AbstractValidator<UpdateOrganization>
{
    public UpdateOrganizationValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.NameIsRequired);
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
        if (organization == null)
        {
            return null;
        }

        organization.Update(request.Name);

        await _service.UpdateAsync(organization);

        return _mapper.Map<OrganizationVm>(organization);
    }
}