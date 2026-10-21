using System.Text.Json;
using Application.AuditLogs;
using Application.Bases.Models;
using AutoMapper;
using Domain.AuditLogs;

namespace Application.UnitTests.Handlers;

public class AuditLogMappingTests
{
    [Theory]
    [InlineData(Operations.ClonePolicy, "system-managed policy/developer")]
    [InlineData(Operations.ClonePolicy, "customer-managed policy/developer")]
    [InlineData(Operations.AddGroupPolicy, null)]
    public void Response_PreservesCloneSourceInComment(
        string operation, string? source)
    {
        var change = new DataChange
        {
            Previous = "{\"name\":\"before\"}",
            Current = "{\"name\":\"after\"}"
        };
        var log = new AuditLog(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "resource-1", operation == Operations.ClonePolicy ? AuditLogRefTypes.Policy : AuditLogRefTypes.Group, "resource", operation,
            change, source == null ? "" : $"Cloned from: {source}", Guid.NewGuid());
        var mapper = new MapperConfiguration(config => config.AddProfile<Application.AuditLogs.MapperProfile>())
            .CreateMapper();

        var page = mapper.Map<PagedResult<AuditLogVm>>(new PagedResult<AuditLog>(1, [log]));
        var result = Assert.Single(page.Items);
        Assert.Equal(operation, result.Operation);
        Assert.Equal(log.Comment, result.Comment);

        using var json = JsonDocument.Parse(JsonSerializer.Serialize(result, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
        var root = json.RootElement;
        foreach (var field in new[] { "workspaceId", "organizationId", "envId", "organizationName", "environmentName", "projectName" })
            Assert.False(root.TryGetProperty(field, out _));
        Assert.Equal(operation, root.GetProperty("operation").GetString());
        Assert.False(root.TryGetProperty("action", out _));
        Assert.False(root.TryGetProperty("assignmentSource", out _));
        Assert.False(root.TryGetProperty("source", out _));
        var dataChange = root.GetProperty("dataChange");
        Assert.False(dataChange.TryGetProperty("source", out _));
        Assert.False(dataChange.TryGetProperty("clonedFrom", out _));
        Assert.Equal(log.Comment, root.GetProperty("comment").GetString());
        Assert.Equal(change.Previous, dataChange.GetProperty("previous").GetString());
        Assert.Equal(change.Current, dataChange.GetProperty("current").GetString());
    }
}
