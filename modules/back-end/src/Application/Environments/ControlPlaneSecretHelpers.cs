using System.Text.Json;
using System.Text.Json.Nodes;
using Domain.Environments;
using Domain.Utils;

namespace Application.Environments;

public static class ControlPlaneSecretHelpers
{
    public static JsonObject CreateAddMessage(ResourceDescriptor resourceDescriptor, Secret secret)
    {
        var resourceDescriptorNode = JsonSerializer.SerializeToNode(resourceDescriptor, ReusableJsonSerializerOptions.Web);
        var secretNode = JsonSerializer.SerializeToNode(secret, ReusableJsonSerializerOptions.Web);
        JsonObject secretUpsertMessage = new()
        {
            ["operation"] = nameof(SecretChangeOperations.Add),
            ["resourceDescriptor"] = resourceDescriptorNode,
            ["secret"] = secretNode
        };

        return secretUpsertMessage;
    }
    
    public static JsonObject CreateDeleteMessage(Secret secret)
    {
        var secretNode = JsonSerializer.SerializeToNode(secret, ReusableJsonSerializerOptions.Web);
        JsonObject secretUpsertMessage = new()
        {
            ["operation"] = nameof(SecretChangeOperations.Delete),
            ["secret"] = secretNode
        };

        return secretUpsertMessage;
    }
}