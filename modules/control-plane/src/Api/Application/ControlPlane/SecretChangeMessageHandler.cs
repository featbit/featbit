using System.Text.Json;
using Application.Caches;
using Domain.Environments;
using Domain.Messages;
using Domain.Utils;

namespace Api.Application.ControlPlane;

public class SecretChangeMessageHandler(
    [FromKeyedServices("compositeCache")] ICacheService cacheService,
    ILogger<SecretChangeMessageHandler> logger)
    : IMessageHandler
{
    public string Topic => ControlPlaneTopics.ControlPlaneSecretChange;

    public async Task HandleAsync(string message)
    {
        try
        {
            using var document = JsonDocument.Parse(message);
            var root = document.RootElement;

            if (!root.TryGetProperty("operation", out var operationProperty))
            {
                throw new InvalidDataException("Invalid secret change data");
            }

            var operation = operationProperty.GetString();

            if (string.IsNullOrWhiteSpace(operation) ||
                !Enum.TryParse(operation, ignoreCase: true, out SecretChangeOperations operationEnum))
            {
                throw new InvalidDataException("Invalid secret change data");
            }

            await (operationEnum switch
            {
                SecretChangeOperations.Add => HandleAdd(root),
                SecretChangeOperations.Delete => HandleDelete(root),
                _ => throw new ArgumentOutOfRangeException(nameof(operationEnum), operationEnum,
                    "Unsupported operation.")
            });
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error handling secret change message");
            throw;
        }
    }

    private async Task HandleAdd(JsonElement root)
    {
        if (!root.TryGetProperty("resourceDescriptor", out var resourceDescriptor) ||
            !root.TryGetProperty("secret", out var secret))
        {
            throw new InvalidDataException("Invalid secret change data");
        }

        var deserializedResourceDescriptor =
            resourceDescriptor.Deserialize<ResourceDescriptor>(ReusableJsonSerializerOptions.Web);
        var deserializedSecret = secret.Deserialize<Secret>(ReusableJsonSerializerOptions.Web);
        if (deserializedResourceDescriptor is null)
        {
            logger.LogError("Invalid secret change data: {Field} is null", nameof(deserializedResourceDescriptor));
            throw new ArgumentNullException(nameof(deserializedResourceDescriptor), "Invalid secret change data.");
        }

        if (deserializedSecret is null)
        {
            logger.LogError("Invalid secret change data: {Field} is null", nameof(deserializedSecret));
            throw new ArgumentNullException(nameof(deserializedSecret), "Invalid secret change data.");
        }

        await cacheService.UpsertSecretAsync(deserializedResourceDescriptor, deserializedSecret)
            .ConfigureAwait(false);
    }

    private async Task HandleDelete(JsonElement root)
    {
        if (!root.TryGetProperty("secret", out var secret))
        {
            throw new InvalidDataException("Invalid secret change data");
        }

        var deserializedSecret = secret.Deserialize<Secret>(ReusableJsonSerializerOptions.Web);
        if (deserializedSecret != null)
        {
            await cacheService.DeleteSecretAsync(deserializedSecret).ConfigureAwait(false);
        }
    }
}