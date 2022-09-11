using System.Diagnostics.CodeAnalysis;
using Microsoft.Extensions.Logging;

namespace Domain.UnitTests;

// taken from
// https://pnguyen.io/posts/verify-ilogger-call-in-dotnet-core/#using-handwritten-mock
[ExcludeFromCodeCoverage]
public class InMemoryFakeLogger<T> : ILogger<T>
{
    public LogLevel Level { get; private set; }
    public Exception? Ex { get; private set; }
    public string? Message { get; private set; }

    public IDisposable BeginScope<TState>(TState state)
    {
        return NullScope.Instance;
    }

    public bool IsEnabled(LogLevel logLevel)
    {
        return true;
    }

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception, string> formatter)
    {
        Level = logLevel;
        Message = state?.ToString();
        Ex = exception;
    }

    /// <summary>
    /// Reference: https://github.com/aspnet/Logging/blob/master/src/Microsoft.Extensions.Logging.Abstractions/Internal/NullScope.cs
    /// </summary>
    public class NullScope : IDisposable
    {
        public static NullScope Instance { get; } = new NullScope();

        private NullScope()
        {
        }

        public void Dispose()
        {
        }
    }
}