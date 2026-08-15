using Application.Bases;
using Application.Bases.Exceptions;
using Domain.Members;
using Domain.Policies;
using Domain.Projects;

namespace Application.Projects;

public class CreateProject : IRequest<ProjectWithEnvs>
{
    /// <summary>
    /// The ID of the organization the project belongs to. Retrieved from the request header.
    /// </summary>
    public Guid OrganizationId { get; set; }

    /// <summary>
    /// The ID of the member creating the project. Empty when the request must not grant member access,
    /// including service-token requests.
    /// </summary>
    public Guid CreatorId { get; set; }

    /// <summary>
    /// The creator's permissions before the project is created.
    /// </summary>
    public PolicyStatement[] CurrentUserPermissions { get; set; } = [];

    /// <summary>
    /// The name of the project
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// The unique key of the project
    /// </summary>
    public string Key { get; set; }
}

public class CreateProjectValidator : AbstractValidator<CreateProject>
{
    public CreateProjectValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));

        RuleFor(x => x.Key)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("key"));
    }
}

public class CreateProjectHandler : IRequestHandler<CreateProject, ProjectWithEnvs>
{
    private static readonly string[] DefaultEnvironmentNames = ["Prod", "Dev"];

    private readonly IProjectService _projectService;
    private readonly IPolicyService _policyService;
    private readonly IMemberService _memberService;
    private readonly IPublisher _publisher;

    public CreateProjectHandler(
        IProjectService projectService,
        IPolicyService policyService,
        IMemberService memberService,
        IPublisher publisher)
    {
        _projectService = projectService;
        _policyService = policyService;
        _memberService = memberService;
        _publisher = publisher;
    }

    public async Task<ProjectWithEnvs> Handle(CreateProject request, CancellationToken cancellationToken)
    {
        var keyHasBeenUsed = await _projectService.HasKeyBeenUsedAsync(request.OrganizationId, request.Key);
        if (keyHasBeenUsed)
        {
            throw new BusinessException(ErrorCodes.KeyHasBeenUsed);
        }

        var creatorAccessStatements = request.CreatorId == Guid.Empty
            ? []
            : ProjectCreatorAccess.BuildGrantStatements(
                request.CurrentUserPermissions,
                request.Key,
                DefaultEnvironmentNames.Select(x => x.ToLowerInvariant()).ToArray()
            );

        var project = new Project(request.OrganizationId, request.Name, request.Key);
        var projectWithEnvs = await _projectService.AddWithEnvsAsync(project, DefaultEnvironmentNames);

        if (creatorAccessStatements.Length > 0)
        {
            var policy = ProjectCreatorAccess.CreatePolicy(
                request.OrganizationId,
                projectWithEnvs,
                creatorAccessStatements
            );

            try
            {
                await _policyService.AddOneAsync(policy);
                await _memberService.AddPolicyAsync(
                    new MemberPolicy(request.OrganizationId, request.CreatorId, policy.Id)
                );
            }
            catch (Exception provisioningError)
            {
                var errors = new List<Exception> { provisioningError };

                try
                {
                    await _policyService.DeleteAsync(policy.Id);
                }
                catch (Exception cleanupError)
                {
                    errors.Add(cleanupError);
                }

                try
                {
                    await _projectService.DeleteAsync(projectWithEnvs.Id);
                }
                catch (Exception cleanupError)
                {
                    errors.Add(cleanupError);
                }

                if (errors.Count > 1)
                {
                    throw new AggregateException(errors);
                }

                throw;
            }
        }

        // publish on project added notification
        await _publisher.Publish(new OnProjectAdded(projectWithEnvs), cancellationToken);

        return projectWithEnvs;
    }
}
