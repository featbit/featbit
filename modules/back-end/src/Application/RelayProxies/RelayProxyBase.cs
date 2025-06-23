using Application.Bases;
using Domain.RelayProxies;

namespace Application.RelayProxies;

public class RelayProxyBase
{
    public string Name { get; set; }

    public string Description { get; set; }

    public bool IsAllEnvs { get; set; }

    public Scope[] Scopes { get; set; }

    public Agent[] Agents { get; set; }
    
    public AutoAgent[] AutoAgents { get; set; }
}

public class WebhookBaseValidator : AbstractValidator<RelayProxyBase>
{
    public WebhookBaseValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));

        RuleFor(x => x.Scopes)
            .Must((proxy, scopes) =>
            {
                if (proxy.IsAllEnvs)
                {
                    return true;
                }

                return scopes?.All(scope => scope.IsValid()) ?? false;
            })
            .WithErrorCode(ErrorCodes.Invalid("scopes"));

        RuleFor(x => x.Agents)
            .Must(agents => agents.All(agent => agent.IsValid()))
            .WithErrorCode(ErrorCodes.Invalid("agents"));
    }
}