using Application.Bases;
using Domain.FeatureFlags;
using FluentValidation.Results;

namespace Application.FeatureFlags;

public static class FlagTargetingValidator
{
    public static void EnsureValid(FeatureFlag flag) => EnsureValid(flag, flag.Variations);

    public static void EnsureValid(FeatureFlag flag, ICollection<Variation> variations) =>
        EnsureValid(new FlagTargeting
        {
            DisabledVariationId = flag.DisabledVariationId,
            TargetUsers = flag.TargetUsers,
            Rules = flag.Rules,
            Fallthrough = flag.Fallthrough,
            ExptIncludeAllTargets = flag.ExptIncludeAllTargets
        }, variations);

    private static readonly ValidationFailure[] Failures =
    [
        new(nameof(FlagTargeting), "Invalid targeting")
        {
            ErrorCode = ErrorCodes.Invalid("targeting")
        }
    ];

    public static void EnsureValid(FlagTargeting targeting, ICollection<Variation> flagVariations)
    {
        if (targeting?.IsValid(flagVariations) == true)
        {
            return;
        }

        throw new ValidationException(Failures);
    }
}
