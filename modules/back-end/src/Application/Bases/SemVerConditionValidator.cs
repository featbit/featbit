using Domain.Targeting;
using FluentValidation.Results;

namespace Application.Bases;

public static class SemVerConditionValidator
{
    public static IEnumerable<ValidationFailure> Validate(IEnumerable<IEnumerable<Condition>> rules)
    {
        if (rules == null) yield break;
        var ruleIndex = 0;
        foreach (var conditions in rules)
        {
            var conditionIndex = 0;
            foreach (var condition in conditions ?? [])
            {
                if (condition != null && !condition.IsSegmentCondition() && OperatorTypes.IsSemVer(condition.Op) &&
                    !OpValueValidator.IsValid(condition.Op, condition.Value))
                {
                    yield return new ValidationFailure($"rules[{ruleIndex}].conditions[{conditionIndex}].value",
                        "Invalid semantic version. Use versions such as 2.3.0; lists require at least one valid version. Spaces, v prefixes and ranges are not supported.")
                    { ErrorCode = ErrorCodes.Invalid("semanticVersion") };
                }
                conditionIndex++;
            }
            ruleIndex++;
        }
    }

    public static void EnsureValid(IEnumerable<IEnumerable<Condition>> rules)
    {
        var failures = Validate(rules).ToArray();
        if (failures.Length > 0) throw new ValidationException(failures);
    }
}
