using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Logging.Testing;
using Xunit;

namespace TestBase;

public sealed class TypedFakeLogger<T> : ILogger<T>, IBufferedLogger
{
    private object? _latestRawState;
    private BufferedLogRecord? _latestBufferedLogRecord;

    public FakeLogger<T> FakeLogger { get; } = new();

    public IDisposable? BeginScope<TState>(TState state)
        where TState : notnull
        => FakeLogger.BeginScope(state);

    public bool IsEnabled(LogLevel logLevel) => FakeLogger.IsEnabled(logLevel);

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter)
    {
        FakeLogger.Log(logLevel, eventId, state, exception, formatter);
        _latestRawState = state;
    }

    public object? GetStructuredStateValue(string name)
    {
        if (_latestBufferedLogRecord is not null)
        {
            Assert.True(
                _latestBufferedLogRecord.Attributes.Any(property => property.Key == name),
                $"Expected structured state '{name}' in buffered record. " +
                $"Keys: {string.Join(", ", _latestBufferedLogRecord.Attributes.Select(property => $"{property.Key}:{property.Value?.GetType().FullName ?? "<null>"}"))}");

            return _latestBufferedLogRecord.Attributes.Single(property => property.Key == name).Value;
        }

        Assert.NotNull(_latestRawState);

        var structuredState =
            Assert.IsAssignableFrom<IReadOnlyList<KeyValuePair<string, object?>>>(_latestRawState);
        Assert.True(
            structuredState.Any(property => property.Key == name),
            $"Expected structured state '{name}' in raw state type '{_latestRawState.GetType().FullName}'. " +
            $"Keys: {string.Join(", ", structuredState.Select(property => $"{property.Key}:{property.Value?.GetType().FullName ?? "<null>"}"))}. " +
            $"Fields: {string.Join(", ", _latestRawState.GetType().GetFields(System.Reflection.BindingFlags.Instance | System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.NonPublic).Select(field => $"{field.Name}={field.GetValue(_latestRawState)}"))}");

        var state = structuredState.Single(property => property.Key == name);

        return state.Value;
    }

    void IBufferedLogger.LogRecords(IEnumerable<BufferedLogRecord> records)
    {
        var bufferedLogRecords = records.ToArray();
        _latestBufferedLogRecord = bufferedLogRecords.LastOrDefault();

        ((IBufferedLogger)FakeLogger).LogRecords(bufferedLogRecords);
    }
}
