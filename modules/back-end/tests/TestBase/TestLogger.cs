#nullable disable

using Microsoft.Extensions.Logging;

namespace TestBase;

// taken from https://github.com/dotnet/aspnetcore/blob/main/src/Identity/Specification.Tests/src/TestLogger.cs

public interface ITestLogger
{
    List<string> LogMessages { get; }
}

public class TestLogger<TName> : ILogger<TName>, ITestLogger
{
    public List<string> LogMessages { get; } = new();

    public IDisposable BeginScope<TState>(TState state) where TState : notnull
    {
        LogMessages.Add(state?.ToString());
        return null;
    }

    public bool IsEnabled(LogLevel logLevel)
    {
        return true;
    }

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception exception,
        Func<TState, Exception, string> formatter)
    {
        LogMessages.Add(formatter == null ? state.ToString() : formatter(state, exception));
    }
}