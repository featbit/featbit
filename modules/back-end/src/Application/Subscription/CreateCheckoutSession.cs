using Application.Bases;
using Application.Bases.Exceptions;
using Domain.Workspaces;

namespace Application.Subscription;

public class CreateCheckoutSession : IRequest<CheckoutSessionVm>
{
    public string Email { get; set; }

    public Guid WorkspaceId { get; set; }

    public string Plan { get; set; }

    public string Interval { get; set; }

    public int Mau { get; set; }

    public string[] ExtraFeatures { get; set; }
}

public class CreateCheckoutSessionValidator : AbstractValidator<CreateCheckoutSession>
{
    public CreateCheckoutSessionValidator()
    {
        RuleFor(x => x.Plan)
            .NotEmpty()
            .Must(Interval.IsDefined)
            .WithErrorCode(ErrorCodes.Invalid("plan"));

        RuleFor(x => x.Mau)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("mau"))
            .GreaterThan(1000).WithErrorCode(ErrorCodes.Invalid("mau"));
        
        RuleFor(x => x.Interval)
            .Must(Interval.IsDefined)
            .WithErrorCode(ErrorCodes.Invalid("interval"));
        
        RuleFor(x => x.ExtraFeatures)
            .Must(features => features.All(LicenseFeatures.IsDefined))
            .WithErrorCode(ErrorCodes.Invalid("extraFeatures"));
    }
}

public class CreateCheckoutSessionHandler(ISubscriptionService subscriptionService)
    : IRequestHandler<CreateCheckoutSession, CheckoutSessionVm>
{
    public async Task<CheckoutSessionVm> Handle(CreateCheckoutSession request, CancellationToken cancellationToken)
    {
        var session = await subscriptionService.CreateCheckoutSessionAsync(
            request.Email,
            request.WorkspaceId,
            request.Plan,
            request.Mau,
            request.ExtraFeatures,
            cancellationToken
        );

        if (session == null)
        {
            throw new BusinessException(ErrorCodes.Failed("checkout-session"));
        }

        return session;
    }
}
