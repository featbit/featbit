using Application.Bases;
using Domain.Targeting;

namespace Application.Segments;

public class SegmentBase
{
    public string Name { get; set; }

    public string Description { get; set; }

    public string[] Scopes { get; set; } = [];

    public string[] Included { get; set; } = [];

    public string[] Excluded { get; set; } = [];

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