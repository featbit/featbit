using System.Text.Json;
using Domain.EndUsers;
using Domain.Messages;
using Domain.Utils;

namespace Infrastructure.MQ;

public class EndUserMessageHandler(IEndUserService service) : IMessageHandler
{
    public string Topic => Topics.EndUser;

    public async Task HandleAsync(string message)
    {
        var endUserMessage =
            JsonSerializer.Deserialize<EndUserMessage>(message, ReusableJsonSerializerOptions.Web);

        // upsert endUser and it's properties
        var endUser = endUserMessage!.AsEndUser();
        await service.UpsertAsync(endUser);
        await service.AddNewPropertiesAsync(endUser);
    }
}