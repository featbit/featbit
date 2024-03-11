using Application.Bases;
using Application.Projects;
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
    private readonly IPublisher _publisher;

    public OnboardingHandler(
        IOrganizationService organizationService,
        IProjectService projectService,
        IPublisher publisher)
    {
        _organizationService = organizationService;
        _projectService = projectService;
        _publisher = publisher;
    }

    public async Task<bool> Handle(Onboarding request, CancellationToken cancellationToken)
    {
        var organization = await _organizationService.GetAsync(request.OrganizationId);
        organization.Initialize(request.OrganizationName);
        await _organizationService.UpdateAsync(organization);

        var project = new Project(organization.Id, request.ProjectName, request.ProjectKey);
        var projectWithEnvs = await _projectService.AddWithEnvsAsync(project, request.Environments);

        // publish on project added notification
        await _publisher.Publish(new OnProjectAdded(projectWithEnvs), cancellationToken);

        return true;
    }
}