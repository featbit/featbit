using Domain.Utils;

namespace Domain.UnitTests.Utils;

public class ValueStopwatchTests
{
    [Fact]
    public void StartNew_ReturnsActiveStopwatch()
    {
        var sw = ValueStopwatch.StartNew();

        Assert.True(sw.IsActive);
    }

    [Fact]
    public void GetElapsedTime_AfterDelay_ReturnsPositiveDuration()
    {
        var sw = ValueStopwatch.StartNew();
        Thread.Sleep(10);

        var elapsed = sw.GetElapsedTime();

        Assert.True(elapsed > TimeSpan.Zero, $"Expected positive elapsed time, got {elapsed}.");
    }

    [Fact]
    public void GetElapsedTime_OnUninitializedInstance_Throws()
    {
        // The class has a private parameterless ctor used only for `default(ValueStopwatch)`-like
        // scenarios via Activator; we replicate the uninitialized state by reflection.
        var ctor = typeof(ValueStopwatch).GetConstructor(
            System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.NonPublic,
            binder: null, types: [typeof(long)], modifiers: null);
        var sw = (ValueStopwatch)ctor!.Invoke([0L]);

        Assert.False(sw.IsActive);
        Assert.Throws<InvalidOperationException>(() => sw.GetElapsedTime());
    }
}
