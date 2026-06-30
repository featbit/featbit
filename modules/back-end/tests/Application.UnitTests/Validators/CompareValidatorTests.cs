using Application.AuditLogs;
using Application.Bases;
using Domain.AuditLogs;

namespace Application.UnitTests.Validators;

public class CompareValidatorTests
{
    private static Compare Valid() => new()
    {
        RefType = AuditLogRefTypes.All.First(),
        DataChange = new DataChange("prev") { Current = "curr" }
    };

    [Fact]
    public void Compare_DefinedRefTypeAndFullDataChange_NoErrors()
    {
        var result = new CompareValidator().Validate(Valid());

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Compare_UndefinedRefType_RefTypeInvalidError()
    {
        var request = Valid();
        request.RefType = "bogus";

        var result = new CompareValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("RefType"));
    }

    [Fact]
    public void Compare_EmptyPrevious_DataChangePreviousInvalidError()
    {
        var request = Valid();
        request.DataChange = new DataChange(null) { Current = "curr" };

        var result = new CompareValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("DataChange.Previous"));
    }

    [Fact]
    public void Compare_EmptyCurrent_DataChangeCurrentInvalidError()
    {
        var request = Valid();
        request.DataChange = new DataChange("prev").To(null);

        var result = new CompareValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("DataChange.Current"));
    }
}
