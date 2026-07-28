using System.Text.Json;
using Domain.ControlPlane;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Streaming.Consumers;
using Streaming.Services;
using Action = Domain.ControlPlane.Action;

namespace Streaming.UnitTests.Consumers;

/// <summary>
/// Verifies the per-DC <see cref="ControlPlaneCommand.TargetDcId"/> filter on the eval-server
/// consumer: a command targeted at THIS pod's DC (config "ControlPlane:DcId") is acted on, a command
/// targeted at a DIFFERENT DC is ignored, and a null TargetDcId is acted on by everyone (the original
/// broadcast behavior). Pure unit test — a mock <see cref="IAdminService"/> asserts whether the
/// full-sync was invoked.
/// </summary>
public class ControlPlaneCommandMessageConsumerTests
{
    private readonly Mock<IAdminService> _adminService = new();

    private ControlPlaneCommandMessageConsumer CreateSut(string? localDcId)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ControlPlane:DcId"] = localDcId
            })
            .Build();

        return new ControlPlaneCommandMessageConsumer(
            _adminService.Object,
            configuration,
            NullLogger<ControlPlaneCommandMessageConsumer>.Instance);
    }

    private static string Serialize(ControlPlaneCommand command) =>
        JsonSerializer.Serialize(command);

    [Fact]
    public async Task TargetDcId_Matches_LocalDc_Acts()
    {
        var sut = CreateSut(localDcId: "west");
        var message = Serialize(new ControlPlaneCommand { Action = Action.PushFullSync, TargetDcId = "west" });

        await sut.HandleAsync(message, CancellationToken.None);

        _adminService.Verify(x => x.PushFullSyncToAllActiveSdks(), Times.Once);
    }

    [Fact]
    public async Task TargetDcId_DoesNotMatch_LocalDc_Ignored()
    {
        var sut = CreateSut(localDcId: "east");
        var message = Serialize(new ControlPlaneCommand { Action = Action.PushFullSync, TargetDcId = "west" });

        await sut.HandleAsync(message, CancellationToken.None);

        _adminService.Verify(x => x.PushFullSyncToAllActiveSdks(), Times.Never);
    }

    [Fact]
    public async Task TargetDcId_Null_Acts_OnEveryDc()
    {
        // No TargetDcId -> broadcast. The local DcId is irrelevant.
        var sut = CreateSut(localDcId: "east");
        var message = Serialize(new ControlPlaneCommand { Action = Action.PushFullSync, TargetDcId = null });

        await sut.HandleAsync(message, CancellationToken.None);

        _adminService.Verify(x => x.PushFullSyncToAllActiveSdks(), Times.Once);
    }

    [Fact]
    public async Task TargetDcId_Set_But_LocalDcUnset_Ignored()
    {
        // A pod with no configured DcId cannot match a targeted command -> it must ignore it.
        var sut = CreateSut(localDcId: null);
        var message = Serialize(new ControlPlaneCommand { Action = Action.PushFullSync, TargetDcId = "west" });

        await sut.HandleAsync(message, CancellationToken.None);

        _adminService.Verify(x => x.PushFullSyncToAllActiveSdks(), Times.Never);
    }
}
