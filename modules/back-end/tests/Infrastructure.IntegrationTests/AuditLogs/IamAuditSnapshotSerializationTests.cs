using System.Text.Json;
using Domain.AuditLogs;

namespace Infrastructure.IntegrationTests.AuditLogs;

public class IamAuditSnapshotSerializationTests
{
    [Theory]
    [InlineData("Member", "email,groups,id,name,policies,rn", "groups,policies")]
    [InlineData("Group", "description,id,members,name,policies,rn", "members,policies")]
    [InlineData("Policy", "description,groups,id,members,name,rn,statements", "groups,members,statements")]
    public void DataChange_PreservesOnlyResourceFields_AndEmptyArrays(string type, string fields, string arrays)
    {
        // Exercise the same base-type/object boundary used when constructing audit changes from resource snapshots.
        IamAuditSnapshot snapshot = type switch
        {
            "Member" => new MemberAuditSnapshot(Guid.NewGuid(), "Member", "member/test@example.com", "test@example.com", [], []),
            "Group" => new GroupAuditSnapshot(Guid.NewGuid(), "Group", "group/test", "", [], []),
            _ => new PolicyAuditSnapshot(Guid.NewGuid(), "Policy", "policy/test", "", [], [], [])
        };
        var change = new DataChange(snapshot).To(snapshot);
        foreach (var raw in new[] { change.Previous, change.Current })
        {
            using var json = JsonDocument.Parse(raw);
            Assert.Equal(fields.Split(','), json.RootElement.EnumerateObject().Select(x => x.Name).Order().ToArray());
            foreach (var field in arrays.Split(','))
            {
                var value = json.RootElement.GetProperty(field);
                Assert.Equal(JsonValueKind.Array, value.ValueKind);
                Assert.Equal(0, value.GetArrayLength());
            }
        }
    }
}
