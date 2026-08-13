using Application.Bases;
using Domain.Policies;
using Domain.Resources;

namespace Application.Members;

public class EvaluateMemberPermissionPayload
{
    public string Resource { get; set; }

    public string Action { get; set; }
}

public class EvaluateMemberPermission : IRequest<MemberPermissionEvaluationVm>
{
    public Guid OrganizationId { get; set; }

    public Guid MemberId { get; set; }

    public string Resource { get; set; }

    public string Action { get; set; }
}

public class EvaluateMemberPermissionValidator : AbstractValidator<EvaluateMemberPermission>
{
    public EvaluateMemberPermissionValidator()
    {
        RuleFor(x => x.Resource)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("resource"));

        RuleFor(x => x.Action)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("action"));
    }
}

public class EvaluateMemberPermissionHandler(IMemberService service)
    : IRequestHandler<EvaluateMemberPermission, MemberPermissionEvaluationVm>
{
    public async Task<MemberPermissionEvaluationVm> Handle(
        EvaluateMemberPermission request,
        CancellationToken cancellationToken)
    {
        var assignments = await service.GetPermissionAssignmentsAsync(request.OrganizationId, request.MemberId);
        var permissions = MemberPermissionMapper.Map(assignments);
        var matchedRules = permissions
            .Where(x => PolicyHelper.IsMatch(x.ToStatement(), request.Resource, request.Action))
            .ToArray();

        var granted = matchedRules.Length > 0 && matchedRules.All(x => x.Effect == EffectType.Allow);
        var decision = granted
            ? MemberPermissionDecisions.Allowed
            : matchedRules.Any(x => x.Effect == EffectType.Deny)
                ? MemberPermissionDecisions.ExplicitDeny
                : MemberPermissionDecisions.NoMatchingRule;

        return new MemberPermissionEvaluationVm
        {
            Granted = granted,
            Decision = decision,
            Resource = request.Resource,
            Action = request.Action,
            MatchedRules = matchedRules
        };
    }
}
