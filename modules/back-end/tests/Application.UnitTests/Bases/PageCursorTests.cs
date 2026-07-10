using Application.Bases.Models;

namespace Application.UnitTests.Bases;

public class PageCursorTests
{
    [Fact]
    public void Constants_Forward_AndBackward_HaveStableLowercaseValues()
    {
        Assert.Equal("forward", PageCursorDirection.Forward);
        Assert.Equal("backward", PageCursorDirection.Backward);
    }

    [Fact]
    public void Record_TwoCursorsWithSameFields_AreEqual()
    {
        var id = Guid.NewGuid();
        var ts = DateTime.UtcNow;

        var a = new PageCursor(id, ts, PageCursorDirection.Forward);
        var b = new PageCursor(id, ts, PageCursorDirection.Forward);

        Assert.Equal(a, b);
    }

    [Fact]
    public void Record_DifferentDirection_AreNotEqual()
    {
        var id = Guid.NewGuid();
        var ts = DateTime.UtcNow;

        var fwd = new PageCursor(id, ts, PageCursorDirection.Forward);
        var bwd = new PageCursor(id, ts, PageCursorDirection.Backward);

        Assert.NotEqual(fwd, bwd);
    }
}
