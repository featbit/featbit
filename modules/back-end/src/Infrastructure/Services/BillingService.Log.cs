using Microsoft.Extensions.Logging;

namespace Infrastructure.Services;

public partial class BillingService
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error,
            "Exception occurred while retrieving subscription for workspace {WorkspaceId}.",
            EventName = "ErrorGetSubscription")]
        public static partial void ErrorGetSubscription(ILogger logger, Guid workspaceId, Exception ex);

        [LoggerMessage(2, LogLevel.Error,
            "Exception occurred while retrieving current billing cycle for workspace {WorkspaceId}.",
            EventName = "ErrorGetCurrentBillingCycle")]
        public static partial void ErrorGetCurrentBillingCycle(ILogger logger, Guid workspaceId, Exception ex);

        [LoggerMessage(3, LogLevel.Error,
            "Exception occurred while creating subscription for {Request}.",
            EventName = "ErrorCreateSubscription")]
        public static partial void ErrorCreateSubscription(ILogger logger, string request, Exception ex);

        [LoggerMessage(4, LogLevel.Error,
            "Exception occurred while getting proration preview for {Request}.",
            EventName = "ErrorGetProrationPreview")]
        public static partial void ErrorGetProrationPreview(ILogger logger, string request, Exception ex);

        [LoggerMessage(5, LogLevel.Error,
            "Exception occurred while upgrading subscription for {Request}.",
            EventName = "ErrorUpgradeSubscription")]
        public static partial void ErrorUpgradeSubscription(ILogger logger, string request, Exception ex);

        [LoggerMessage(6, LogLevel.Error,
            "Exception occurred while downgrading subscription for {Request}.",
            EventName = "ErrorDowngradeSubscription")]
        public static partial void ErrorDowngradeSubscription(ILogger logger, string request, Exception ex);

        [LoggerMessage(7, LogLevel.Error,
            "Exception occurred while retrieving license for workspace {WorkspaceId}.",
            EventName = "ErrorGetLicense")]
        public static partial void ErrorGetLicense(ILogger logger, Guid workspaceId, Exception ex);

        [LoggerMessage(8, LogLevel.Error,
            "Exception occurred while creating free license for workspace {WorkspaceId} with email {Email}.",
            EventName = "ErrorCreateFreeLicense")]
        public static partial void ErrorCreateFreeLicense(ILogger logger, Guid workspaceId, string email, Exception ex);

        [LoggerMessage(9, LogLevel.Error,
            "Exception occurred while retrieving billing information for workspace {WorkspaceId}.",
            EventName = "ErrorGetBillingInformation")]
        public static partial void ErrorGetBillingInformation(ILogger logger, Guid workspaceId, Exception ex);

        [LoggerMessage(10, LogLevel.Error,
            "Exception occurred while updating billing information for workspace {WorkspaceId}. Payload: {Payload}",
            EventName = "ErrorUpdateBillingInformation")]
        public static partial void ErrorUpdateBillingInformation(
            ILogger logger, Guid workspaceId, string payload, Exception ex);

        [LoggerMessage(11, LogLevel.Error,
            "Exception occurred while retrieving invoices for workspace {WorkspaceId}.",
            EventName = "ErrorGetInvoices")]
        public static partial void ErrorGetInvoices(ILogger logger, Guid workspaceId, Exception ex);
    }
}
