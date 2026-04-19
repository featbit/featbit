using Application.Bases;
using Application.Bases.Exceptions;

namespace Application.Checkout;

public class CreateCheckoutSession : IRequest<CheckoutSessionVm>
{
    /// <summary>
    /// Price in smallest currency unit (e.g. 1399 for 13.99 USD)
    /// </summary>
    public long Amount { get; set; }

    public string Currency { get; set; } = "usd";

    public string SuccessUrl { get; set; }

    public string CancelUrl { get; set; }
}

public class CreateCheckoutSessionValidator : AbstractValidator<CreateCheckoutSession>
{
    public CreateCheckoutSessionValidator()
    {
        RuleFor(x => x.Amount)
            .GreaterThan(0).WithErrorCode(ErrorCodes.Invalid("amount"));

        RuleFor(x => x.Currency)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("currency"));

        RuleFor(x => x.SuccessUrl)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("successUrl"));

        RuleFor(x => x.CancelUrl)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("cancelUrl"));
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
        var session = await checkoutService.CreateSessionAsync(
            request.Amount,
            request.Currency,
            request.SuccessUrl,
            request.CancelUrl,
            cancellationToken
        );

        if (session == null)
        {
            throw new BusinessException(ErrorCodes.Failed("checkout-session"));
        }

        return session;
    }
}
