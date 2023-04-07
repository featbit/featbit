using System.Text.Json;
using Domain.EndUsers;
using Domain.Messages;
using Domain.Utils;

namespace Infrastructure.Messages;

public class EndUserMessageHandler : IMessageHandler
{
    public string Topic => Topics.EndUser;

    private readonly IEndUserService _service;

    public EndUserMessageHandler(IEndUserService service)
    {
        _service = service;
    }

    public async Task HandleAsync(string message, CancellationToken cancellationToken)
    {
        var endUserMessage =
            JsonSerializer.Deserialize<EndUserMessage>(message, ReusableJsonSerializerOptions.Web);

        // upsert endUser and it's properties
        var endUser = endUserMessage!.AsEndUser();
        await _service.UpsertAsync(endUser);
        await _service.AddNewPropertiesAsync(endUser);
    }
}