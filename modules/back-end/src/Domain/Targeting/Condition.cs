using Domain.EndUsers;
using Domain.Segments;

namespace Domain.Targeting;

public class Condition
{
    /// <summary>
    /// The condition ID. Usually a UUID.
    /// </summary>
    public string Id { get; set; }

    /// <summary>
    /// The property to evaluate.
    /// </summary>
    public string Property { get; set; }

    /// <summary>
    /// The operator to use for evaluation.
    /// </summary>
    public string Op { get; set; }

    /// <summary>
    /// The value to compare against.
    /// </summary>
    public string Value { get; set; }

    public bool IsSegmentCondition()
    {
        var isSegmentProperty = SegmentConsts.ConditionProperties.Contains(Property);

        return isSegmentProperty;
    }

    public bool IsMatch(EndUser user)
    {
        var userValue = user.ValueOf(Property);

        var theOperator = Operator.Get(Op);
        return theOperator.IsMatch(userValue, Value);
    }

    public bool IsMultiValue()
    {
        if (IsSegmentCondition())
        {
            return true;
        }

        string[] multiOps = [OperatorTypes.IsOneOf, OperatorTypes.NotOneOf];
        return multiOps.Contains(Op);
    }

    public void Assign(Condition source)
    {
        if (source.Id != Id)
        {
            return;
        }

        Property = source.Property;
        Op = source.Op;
        Value = source.Value;
    }

    public bool ValueEquals(object obj)
    {
        return obj is Condition condition &&
               condition.Id == Id &&
               condition.Property == Property &&
               condition.Op == Op &&
               condition.Value == Value;
    }
}