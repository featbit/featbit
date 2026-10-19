using System.Text.Json;
using Application.AuditLogs;
using Application.Bases.Models;
using AutoMapper;
using Domain.AuditLogs;

namespace Application.UnitTests.Handlers;

public class AuditLogMappingTests
{
    [Theory]
    [InlineData(Operations.ClonePolicy, "policy/developer")]
    [InlineData(Operations.AddGroupPolicy, null)]
    public void Response_PreservesMetadataAtTopLevel_AndOnlySnapshotsInDataChange(
        string operation, string? source)
    {
        var change = new DataChange
        {
            Source = source,
            Previous = "{\"name\":\"before\"}",
            Current = "{\"name\":\"after\"}"
        };
        var log = new AuditLog(null, "resource-1", operation == Operations.ClonePolicy ? AuditLogRefTypes.Policy : AuditLogRefTypes.Group, "resource", operation,
            change, "", Guid.NewGuid());
        var mapper = new MapperConfiguration(config => config.AddProfile<Application.AuditLogs.MapperProfile>())
            .CreateMapper();

        var page = mapper.Map<PagedResult<AuditLogVm>>(new PagedResult<AuditLog>(1, [log]));
        var result = Assert.Single(page.Items);
        Assert.Equal(operation, result.Operation);
        Assert.Equal(source, result.Source);

        using var json = JsonDocument.Parse(JsonSerializer.Serialize(result, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
        var root = json.RootElement;
        Assert.Equal(operation, root.GetProperty("operation").GetString());
        Assert.False(root.TryGetProperty("action", out _));
        Assert.False(root.TryGetProperty("assignmentSource", out _));
        Assert.Equal(source, root.GetProperty("source").GetString());
        var dataChange = root.GetProperty("dataChange");
        Assert.Equal(new[] { "previous", "current" }, dataChange.EnumerateObject().Select(x => x.Name));
        Assert.Equal(change.Previous, dataChange.GetProperty("previous").GetString());
        Assert.Equal(change.Current, dataChange.GetProperty("current").GetString());
        Assert.Equal(source, change.Source);
    }
}
