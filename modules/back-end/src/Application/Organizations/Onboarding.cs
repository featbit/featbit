using Application.Bases;
using Application.Users;
using Domain.Projects;

namespace Application.Organizations;

public class Onboarding : IRequest<bool>
{
    public Guid OrganizationId { get; set; }
    
    public string OrganizationName { get; set; }

    public string ProjectName { get; set; }

    public ICollection<string> Environments { get; set; }
}

public class OnboardingValidator : AbstractValidator<Onboarding>
{
    public OnboardingValidator()
    {
        RuleFor(x => x.OrganizationName)
            .NotEmpty().WithErrorCode(ErrorCodes.OrganizationNameRequired);
        
        RuleFor(x => x.ProjectName)
            .NotEmpty().WithErrorCode(ErrorCodes.ProjectNameRequired);
        
        RuleFor(x => x.Environments).NotNull()
            .NotEmpty().WithErrorCode(ErrorCodes.EnvironmentsRequired);
    }
}

public class OnboardingHandler : IRequestHandler<Onboarding, bool>
{
    private readonly IOrganizationService _organizationService;
    private readonly ICurrentUser _currentUser;
    private readonly IProjectService _projectService;

    public OnboardingHandler(
        IOrganizationService organizationService,
        ICurrentUser currentUser,
        IProjectService projectService)
    {
        _organizationService = organizationService;
        _currentUser = currentUser;
        _projectService = projectService;
    }

    public async Task<bool> Handle(Onboarding request, CancellationToken cancellationToken)
    {
        var organization = await _organizationService.GetAsync(request.OrganizationId);
        organization.Update(request.OrganizationName, true);
        await _organizationService.UpdateAsync(organization);

        var project = new Project
        {
            OrganizationId = organization.Id,
            Name = request.ProjectName
        };

        await _projectService.AddWithEnvsAsync(project, request.Environments);

        return true;
    }
}