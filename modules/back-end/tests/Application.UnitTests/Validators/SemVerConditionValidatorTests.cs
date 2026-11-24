using Application.Bases;
using Domain.Targeting;

namespace Application.UnitTests.Validators;

public class SemVerConditionValidatorTests
{
    [Theory]
    [InlineData("SemVerBiggerEqualThan", "1.2", true)]
    [InlineData("SemVerBiggerEqualThan", "1.2.3.4", false)]
    [InlineData("SemVerNotOneOf", "[\"1.2\",\"2.0.0\"]", true)]
    [InlineData("SemVerNotOneOf", "[\"1.2\",\"bad\"]", false)]
    public void IdentifiesTheInvalidCondition(string op, string value, bool valid)
    {
        Condition[][] rules = [[], [new() { Property = "version", Op = op, Value = value }]];
        var failures = SemVerConditionValidator.Validate(rules).ToArray();
        if (valid) Assert.Empty(failures);
        else Assert.Equal("rules[1].conditions[0].value", Assert.Single(failures).PropertyName);
    }
}
