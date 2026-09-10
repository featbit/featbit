using System.Text.Json;
using Application.Caches;
using Domain.Messages;
using Domain.Observability;

namespace Api.Application.ControlPlane;

public class ClientConnectionClosedHandler(ICacheService cacheService, ILogger<ClientConnectionClosedHandler> logger) : IMessageHandler
{
	private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

	public string Topic => ControlPlaneTopics.ConnectionClosed;

	public async Task HandleAsync(string message)
	{
		// Logged in full apart from the client's SDK secret, which Redaction.HideCredentials
		// hashes in place (docs/observability/index.md §7). Without that this handler would be
		// the back door through which every credential protected elsewhere still reached the log.
		logger.LogInformation("Handling connection closed message: {Message}", Redaction.HideCredentials(message));

		ConnectionMessage? connectionInfo;
		try
		{
			connectionInfo = JsonSerializer.Deserialize<ConnectionMessage>(message, JsonOptions);
		}
		catch (JsonException ex)
		{
			// Caught and not rethrown, so the consumer records this message as successfully
			// consumed. Without this counter the failure is invisible at every layer.
			ControlPlaneMetrics.Current.RecordSuppressedFailure(
				HandlerNames.ClientConnectionClosed, SuppressedFailureReasons.DeserializationFailed);
			logger.LogError(ex, "Failed to deserialize connection message: {Message}", Redaction.HideCredentials(message));
			return;
		}

		if (!TryValidate(connectionInfo, message))
		{
			ControlPlaneMetrics.Current.RecordSuppressedFailure(
				HandlerNames.ClientConnectionClosed, SuppressedFailureReasons.ValidationFailed);
			return;
		}

		await cacheService.DeleteConnectionMadeAsync(connectionInfo!);
	}

	private bool TryValidate(ConnectionMessage? connectionInfo, string rawMessage)
	{
		if (connectionInfo is null)
		{
			logger.LogError("Connection message is null after deserialization: {Message}",
				Redaction.HideCredentials(rawMessage));
			return false;
		}

		if (string.IsNullOrWhiteSpace(connectionInfo.Id))
		{
			logger.LogError("Connection id is null or empty: {Message}", Redaction.HideCredentials(rawMessage));
			return false;
		}

		if (string.IsNullOrWhiteSpace(connectionInfo.Secret))
		{
			logger.LogError("Connection secret is null or empty. Connection: {ConnectionId}", connectionInfo.Id);
			return false;
		}

		if (connectionInfo.EnvId == Guid.Empty)
		{
			logger.LogError("Connection env id is empty. Connection: {ConnectionId}", connectionInfo.Id);
			return false;
		}

		return true;
	}
}