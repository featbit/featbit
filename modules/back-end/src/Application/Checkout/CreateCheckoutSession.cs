using Application.Bases;
using Application.Bases.Exceptions;

namespace Application.Checkout;

public class CreateCheckoutSession : IRequest<CheckoutSessionVm>
{
    /// <summary>
    /// Price in smallest currency unit (e.g. 1399 for 13.99 USD)
    /// </summary>
    public long UnitAmount { get; set; }

    public string Currency { get; set; } = "usd";
}

public class CreateCheckoutSessionValidator : AbstractValidator<CreateCheckoutSession>
{
    public CreateCheckoutSessionValidator()
    {
        RuleFor(x => x.UnitAmount)
            .GreaterThan(0).WithErrorCode(ErrorCodes.Invalid("unitAmount"));

        RuleFor(x => x.Currency)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("currency"));
    }
}

public class CheckoutSessionVm
{
    public string Url { get; set; }
}

public class CreateCheckoutSessionHandler(ICheckoutService checkoutService)
    : IRequestHandler<CreateCheckoutSession, CheckoutSessionVm>
{
    public async Task<CheckoutSessionVm> Handle(CreateCheckoutSession request, CancellationToken cancellationToken)
    {
        var session = await checkoutService.CreateCheckoutSessionAsync(
            request.UnitAmount,
            cancellationToken
        );

        if (session == null)
        {
            throw new BusinessException(ErrorCodes.Failed("checkout-session"));
        }

        return session;
    }
}
