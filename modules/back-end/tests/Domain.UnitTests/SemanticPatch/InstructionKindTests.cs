using System.Reflection;
using Domain.SemanticPatch;

namespace Domain.UnitTests.SemanticPatch;

public class InstructionKindTests
{
    [Fact]
    public void FlagAllKinds()
    {
        var definedKinds = typeof(FlagInstructionKind)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(info => info.IsLiteral && info.FieldType == typeof(string))
            .Select(info => (string)info.GetRawConstantValue()!)
            .OrderBy(kind => kind, StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(definedKinds, FlagInstructionKind.All.OrderBy(kind => kind, StringComparer.Ordinal).ToArray());
    }

    [Fact]
    public void SegmentAllKinds()
    {
        var definedKinds = typeof(SegmentInstructionKind)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(info => info.IsLiteral && info.FieldType == typeof(string))
            .Select(info => (string)info.GetRawConstantValue()!)
            .OrderBy(kind => kind, StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(definedKinds, SegmentInstructionKind.All.OrderBy(kind => kind, StringComparer.Ordinal).ToArray());
    }
}
