namespace Application.RelayProxies;

public class RpAgentBase
{
    public string Host { get; set; }
}

public class RpAgentBaseValidator : AbstractValidator<RpAgentBase>
{
    public RpAgentBaseValidator()
    {
        RuleFor(x => x.Host)
            .NotEmpty()
            .WithMessage("Agent host cannot be empty.")
            .Matches(@"^(http|https)://")
            .WithMessage("Agent host must start with http:// or https://");
    }
}