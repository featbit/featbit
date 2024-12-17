using Application.Bases;
using Domain.Targeting;

namespace Application.Segments;

public class SegmentBase
{
    public string Name { get; set; }

    public string Description { get; set; }

    public ICollection<string> Scopes { get; set; } = Array.Empty<string>();

    public ICollection<string> Included { get; set; } = Array.Empty<string>();

    public ICollection<string> Excluded { get; set; } = Array.Empty<string>();

    public ICollection<MatchRule> Rules { get; set; } = Array.Empty<MatchRule>();
}

public class SegmentBaseValidator : AbstractValidator<SegmentBase>
{
    public SegmentBaseValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Invalid("name"));

        RuleFor(x => x.Scopes)
            .NotEmpty().WithErrorCode(ErrorCodes.Invalid("scopes"))
            .Must(scopes => !scopes.Any(x => x.Contains('*'))).WithErrorCode(ErrorCodes.Invalid("scopes"));

        RuleFor(x => x.Rules)
            .Must(rules =>
            {
                var conditions = rules.SelectMany(x => x.Conditions);
                return conditions.All(x => !x.IsSegmentCondition());
            }).WithErrorCode(ErrorCodes.Invalid("rules"));
    }
}