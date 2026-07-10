using Application.Bases.Exceptions;

namespace Application.UnitTests.Bases;

public class ExceptionTests
{
    [Fact]
    public void BusinessException_StoresErrorCodeInMessage()
    {
        var ex = new BusinessException("oops");

        Assert.Equal("oops", ex.Message);
    }

    [Fact]
    public void EntityNotFoundException_FormatsResourceAndKey()
    {
        var ex = new EntityNotFoundException("User", "abc");

        Assert.Equal("resource \"User\" (abc) was not found.", ex.Message);
    }
}
