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

        [LoggerMessage(EventId = 3, Level = LogLevel.Warning, Message = "Invalid message type",
            EventName = "InvalidMessageType")]
        public static partial void InvalidMessageType(
            ILogger logger,
            [TagProvider(typeof(ConnectionContextTagProvider), nameof(ConnectionContextTagProvider.RecordTags))]
            ConnectionContext connection
        );

        [LoggerMessage(EventId = 4, Level = LogLevel.Warning, Message = "Unknown message type: {MessageType}",
            EventName = "UnknownMessageType")]
        public static partial void UnknownMessageType(
            ILogger logger,
            string messageType,
            [TagProvider(typeof(ConnectionContextTagProvider), nameof(ConnectionContextTagProvider.RecordTags))]
            ConnectionContext connection
        );

        [LoggerMessage(EventId = 5, Level = LogLevel.Warning, Message = "Too many fragments for message",
            EventName = "TooManyFragments")]
        public static partial void TooManyFragments(
            ILogger logger,
            [TagProvider(typeof(ConnectionContextTagProvider), nameof(ConnectionContextTagProvider.RecordTags))]
            ConnectionContext connection
        );

        [LoggerMessage(EventId = 6, Level = LogLevel.Warning, Message = "Invalid message format",
            EventName = "InvalidMessage")]
        public static partial void InvalidMessage(
            ILogger logger,
            [TagProvider(typeof(ConnectionContextTagProvider), nameof(ConnectionContextTagProvider.RecordTags))]
            ConnectionContext connection,
            Exception ex
        );

        [LoggerMessage(EventId = 7, Level = LogLevel.Trace, Message = "Received {Length} bytes message from client",
            EventName = "Received")]
        public static partial void Received(
            ILogger logger,
            int length,
            [TagProvider(typeof(ConnectionContextTagProvider), nameof(ConnectionContextTagProvider.RecordTags))]
            ConnectionContext connection
        );

        [LoggerMessage(EventId = 8, Level = LogLevel.Warning,
            Message = "Received multi-fragment message of length {Length} from client. This should be a rare case.",
            EventName = "ReceivedMultiFragment")]
        public static partial void ReceivedMultiFragment(
            ILogger logger,
            int length,
            [TagProvider(typeof(ConnectionContextTagProvider), nameof(ConnectionContextTagProvider.RecordTags))]
            ConnectionContext connection
        );

        [LoggerMessage(EventId = 9, Level = LogLevel.Error,
            Message = "Exception occurred while handling message",
            EventName = "ErrorHandleMessage")]
        public static partial void ErrorHandleMessage(
            ILogger logger,
            [TagProvider(typeof(ConnectionContextTagProvider), nameof(ConnectionContextTagProvider.RecordTags))]
            ConnectionContext connection,
            Exception ex
        );

        [LoggerMessage(EventId = 10, Level = LogLevel.Error, Message = "Exception occurred while dispatching message",
            EventName = "ErrorDispatchMessage")]
        public static partial void ErrorDispatchMessage(
            ILogger logger,
            [TagProvider(typeof(ConnectionContextTagProvider), nameof(ConnectionContextTagProvider.RecordTags))]
            ConnectionContext connection,
            Exception ex
        );
    }
}