using Domain.EndUsers;
using Domain.Segments;

namespace Domain.Targeting;

public class Condition
{
    public string Id { get; set; }

    public string Property { get; set; }

    public string Op { get; set; }

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