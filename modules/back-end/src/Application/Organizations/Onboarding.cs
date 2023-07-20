using Application.Bases;
using Domain.Projects;

namespace Application.Organizations;

public class Onboarding : IRequest<bool>
{
    public Guid OrganizationId { get; set; }

    public string OrganizationName { get; set; }

    public string ProjectName { get; set; }

    public string ProjectKey { get; set; }

    public ICollection<string> Environments { get; set; }
}

public class OnboardingValidator : AbstractValidator<Onboarding>
{
    public OnboardingValidator()
    {
        RuleFor(x => x.OrganizationName)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("organizationName"));

        RuleFor(x => x.ProjectName)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("projectName"));

        RuleFor(x => x.ProjectKey)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("projectKey"));

        RuleFor(x => x.Environments).NotNull()
            .NotEmpty().WithErrorCode(ErrorCodes.Required("environments"));
    }
}

public class OnboardingHandler : IRequestHandler<Onboarding, bool>
{
    private readonly IOrganizationService _organizationService;
    private readonly IProjectService _projectService;

    public OnboardingHandler(IOrganizationService organizationService, IProjectService projectService)
    {
        _organizationService = organizationService;
        _projectService = projectService;
    }

    public async Task<bool> Handle(Onboarding request, CancellationToken cancellationToken)
    {
        var organization = await _organizationService.GetAsync(request.OrganizationId);
        organization.Update(request.OrganizationName, true);
        await _organizationService.UpdateAsync(organization);

        var project = new Project(organization.Id, request.ProjectName, request.ProjectKey);
        await _projectService.AddWithEnvsAsync(project, request.Environments);

        return true;
    }
}