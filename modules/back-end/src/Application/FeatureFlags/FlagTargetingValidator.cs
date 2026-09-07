using Application.Bases;
using Domain.FeatureFlags;
using FluentValidation.Results;

namespace Application.FeatureFlags;

public static class FlagTargetingValidator
{
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
