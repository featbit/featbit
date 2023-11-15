using Application.Bases;
using Application.Users;
using Domain.Organizations;
using Domain.Policies;

namespace Application.Organizations;

public class CreateOrganization : IRequest<OrganizationVm>
{
    public Guid WorkspaceId { get; set; }

    public string Name { get; set; }
}

public class CreateOrganizationValidator : AbstractValidator<CreateOrganization>
{
    public CreateOrganizationValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));
    }
}

public class CreateOrganizationHandler : IRequestHandler<CreateOrganization, OrganizationVm>
{
    private readonly IOrganizationService _service;
    private readonly ICurrentUser _currentUser;
    private readonly IMapper _mapper;

    public CreateOrganizationHandler(
        IOrganizationService service,
        ICurrentUser currentUser,
        IMapper mapper)
    {
        _service = service;
        _currentUser = currentUser;
        _mapper = mapper;
    }

    public async Task<OrganizationVm> Handle(CreateOrganization request, CancellationToken cancellationToken)
    {
        // add new organization
        var organization = new Organization(request.WorkspaceId, request.Name);
        await _service.AddOneAsync(organization);

        // add user to organization
        var organizationUser = new OrganizationUser(organization.Id, _currentUser.Id);
        var policies = new[] { BuiltInPolicy.Owner };
        await _service.AddUserAsync(organizationUser, policies: policies);

        return _mapper.Map<OrganizationVm>(organization);
    }
}