using System.Text.Json;
using Domain.EndUsers;
using Domain.Evaluation;
using Domain.Shared;
using Moq;

namespace Domain.UnitTests.Evaluation;

public class RuleMatcherTests
{
    private const string SegmentId = "12345678-abcd-abcd-abcd-1234567890ab";

    public static IEnumerable<object[]> BooleanConditions =>
        from op in new[] { "IsTrue", "IsFalse" }
        from operand in new[] { "null", "missing", "empty" }
        from userValue in new[] { "true", "false" }
        from segment in new[] { false, true }
        select new object[] { op, operand, userValue, segment };

    [Theory]
    [MemberData(nameof(BooleanConditions))]
    public async Task IsMatchAsync_BooleanCondition_IgnoresOperand(
        string op, string operand, string userValue, bool segment)
    {
        var condition = new Dictionary<string, object?> { ["property"] = "beta", ["op"] = op };
        if (operand != "missing")
            condition["value"] = operand == "null" ? null : "";
        var rule = JsonSerializer.SerializeToElement(new { conditions = new[] { condition } });
        var store = new Mock<IStore>(MockBehavior.Strict);
        if (segment)
        {
            store.Setup(x => x.GetSegmentAsync(SegmentId)).ReturnsAsync(JsonSerializer.SerializeToUtf8Bytes(new
            {
                included = Array.Empty<string>(), excluded = Array.Empty<string>(), rules = new[] { rule }
            }));
            rule = SegmentRule(SegmentId);
        }
        var user = new EndUser { KeyId = "user", CustomizedProperties = [new() { Name = "beta", Value = userValue }] };

        var result = await new RuleMatcher(store.Object).IsMatchAsync(rule, user);

        Assert.Equal(op == "IsTrue" ? userValue == "true" : userValue == "false", result);
    }

    [Fact]
    public async Task IsMatchAsync_UppercaseSegmentReference_ReadsCanonicalId()
    {
        var store = new Mock<IStore>(MockBehavior.Strict);
        store.Setup(x => x.GetSegmentAsync(SegmentId)).ReturnsAsync(
            JsonSerializer.SerializeToUtf8Bytes(new { included = new[] { "user" }, excluded = Array.Empty<string>(), rules = Array.Empty<object>() }));

        var result = await new RuleMatcher(store.Object).IsMatchAsync(SegmentRule(SegmentId.ToUpperInvariant()), new EndUser { KeyId = "user" });

        Assert.True(result);
        store.Verify(x => x.GetSegmentAsync(SegmentId), Times.Once);
    }

    [Theory]
    [InlineData("Equal")]
    [InlineData("BiggerThan")]
    public async Task IsMatchAsync_NonBooleanNullOperand_StillRejectsMalformedData(string op)
    {
        var rule = JsonSerializer.SerializeToElement(new { conditions = new[] { new { property = "beta", op, value = (string?)null } } });

        await Assert.ThrowsAsync<MalformedDataException>(async () =>
            await new RuleMatcher(Mock.Of<IStore>()).IsMatchAsync(rule, new EndUser { KeyId = "user" }));
    }

    private static JsonElement SegmentRule(string id) => JsonSerializer.SerializeToElement(new
    {
        conditions = new[] { new { property = "User is in segment", op = "IsOneOf", value = JsonSerializer.Serialize(new[] { id }) } }
    });
}
