using Domain.Insights;

namespace Domain.UnitTests.Insights;

public class MetricInsightTests
{
    [Theory]
    [InlineData("my-event")]
    [InlineData("event_123")]
    [InlineData("A")]
    [InlineData("valid-event_42")]
    [InlineData("ALLCAPS")]
    public void IsValid_WithValidEventName_ReturnsTrue(string eventName)
    {
        var insight = new MetricInsight { EventName = eventName };
        Assert.True(insight.IsValid());
    }

    [Fact]
    public void IsValid_WithEventNameExactly40Characters_ReturnsTrue()
    {
        var insight = new MetricInsight { EventName = new string('a', 40) };
        Assert.True(insight.IsValid());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t")]
    public void IsValid_WithNullOrWhitespaceEventName_ReturnsFalse(string? eventName)
    {
        var insight = new MetricInsight { EventName = eventName! };
        Assert.False(insight.IsValid());
    }

    [Fact]
    public void IsValid_WithEventNameExceeding40Characters_ReturnsFalse()
    {
        var insight = new MetricInsight { EventName = new string('a', 41) };
        Assert.False(insight.IsValid());
    }

    [Theory]
    // disallowed characters
    [InlineData("event name")]                    // space
    [InlineData("event.name")]                    // dot
    [InlineData("event@name")]                    // @
    [InlineData("event!name")]                    // !
    // injection attempts
    [InlineData("'; DROP TABLE events; --")]       // SQL injection
    [InlineData("<script>alert(1)</script>")]      // XSS
    [InlineData("../../etc/passwd")]               // path traversal
    [InlineData("$(rm -rf /)")]                    // shell command injection
    [InlineData("%00event")]                       // URL-encoded null byte
    [InlineData("event\nname")]                    // newline
    [InlineData("event\0name")]                    // null byte
    public void IsValid_WithInvalidOrMaliciousEventName_ReturnsFalse(string eventName)
    {
        var insight = new MetricInsight { EventName = eventName };
        Assert.False(insight.IsValid());
    }
}