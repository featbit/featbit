using Microsoft.Extensions.Logging;
using Streaming.Connections;

namespace Streaming.Messages;

sealed partial class MessageDispatcher
{
    public static partial class Log
    {
        [LoggerMessage(EventId = 1, Level = LogLevel.Trace, Message = "Received close message",
            EventName = "ReceivedClose")]
        public static partial void ReceivedClose(
            ILogger logger,
            [TagProvider(typeof(ConnectionContextTagProvider), nameof(ConnectionContextTagProvider.RecordTags))]
            ConnectionContext connection
        );

        [LoggerMessage(EventId = 2, Level = LogLevel.Trace, Message = "Received empty message",
            EventName = "ReceivedEmpty")]
        public static partial void ReceivedEmpty(
            ILogger logger,
            [TagProvider(typeof(ConnectionContextTagProvider), nameof(ConnectionContextTagProvider.RecordTags))]
            ConnectionContext connection
        );

        [LoggerMessage(EventId = 3, Level = LogLevel.Warning, Message = "No handler for message type: {MessageType}",
            EventName = "NoHandlerFor")]
        public static partial void NoHandlerFor(
            ILogger logger,
            string messageType,
            [TagProvider(typeof(ConnectionContextTagProvider), nameof(ConnectionContextTagProvider.RecordTags))]
            ConnectionContext connection);

        [LoggerMessage(EventId = 4, Level = LogLevel.Warning, Message = "Too many fragments for message",
            EventName = "TooManyFragments")]
        public static partial void TooManyFragments(
            ILogger logger,
            [TagProvider(typeof(ConnectionContextTagProvider), nameof(ConnectionContextTagProvider.RecordTags))]
            ConnectionContext connection
        );

        [LoggerMessage(EventId = 5, Level = LogLevel.Warning, Message = "Received invalid message: {Message}",
            EventName = "ReceivedInvalid")]
        public static partial void ReceivedInvalid(
            ILogger logger,
            string message,
            [TagProvider(typeof(ConnectionContextTagProvider), nameof(ConnectionContextTagProvider.RecordTags))]
            ConnectionContext connection
        );

        [LoggerMessage(EventId = 6, Level = LogLevel.Error, Message = "Exception occurred while processing message: {Message}",
            EventName = "ErrorHandleMessage")]
        public static partial void ErrorHandleMessage(
            ILogger logger,
            string message,
            [TagProvider(typeof(ConnectionContextTagProvider), nameof(ConnectionContextTagProvider.RecordTags))]
            ConnectionContext connection,
            Exception ex
        );

        [LoggerMessage(EventId = 7, Level = LogLevel.Error, Message = "Exception occurred while dispatching message",
            EventName = "ErrorDispatchMessage")]
        public static partial void ErrorDispatchMessage(
            ILogger logger,
            [TagProvider(typeof(ConnectionContextTagProvider), nameof(ConnectionContextTagProvider.RecordTags))]
            ConnectionContext connection,
            Exception ex
        );
    }
}