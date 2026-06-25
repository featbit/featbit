using Application.Bases.Models;

namespace Application.UnitTests.Bases;

public class PagedRequestTests
{
    [Fact]
    public void Defaults_ZeroIndex_TenPageSize()
    {
        var request = new PagedRequest();

        Assert.Equal(0, request.PageIndex);
        Assert.Equal(10, request.PageSize);
    }

    [Fact]
    public void PagedResult_PassesThroughTotalAndItems()
    {
        var items = new[] { "a", "b" };

        var result = new PagedResult<string>(2, items);

        Assert.Equal(2, result.TotalCount);
        Assert.Equal(items, result.Items);
    }
}
