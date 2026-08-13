using Application.AuditLogs;
using Domain.AuditLogs;

namespace Application.UnitTests.Handlers;

public class CompareHandlerTests
{
    [Fact]
    public async Task Handle_UnknownRefType_ReturnsEmpty()
    {
        var sut = new CompareHandler();
        var request = new Compare
        {
            RefType = "unknown",
            DataChange = new DataChange("{}") { Current = "{}" }
        };

        var result = await sut.Handle(request, CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task Handle_RefTypeNull_ReturnsEmpty()
    {
        var sut = new CompareHandler();
        var request = new Compare
        {
            RefType = null,
            DataChange = new DataChange("{}") { Current = "{}" }
        };

        var result = await sut.Handle(request, CancellationToken.None);

        Assert.Empty(result);
    }
}
