using Domain.EndUsers;

namespace Domain.UnitTests.EndUsers;

public class EndUserTests
{
    [Theory]
    [ClassData(typeof(EndUsersToString))]
    public void EndUserToString(EndUser user, string expected)
    {
        Assert.Equal(expected, user.ToString());
    }
}

public class EndUsersToString : TheoryData<EndUser, string>
{
    public EndUsersToString()
    {
        var envId = Guid.Parse("2907cb3a-fff7-47dc-9ceb-7043a3d9a03f");

        var withNullCustomizedProperties = new EndUser(workspaceId: null, envId, "end-user-key", "end-user", customizedProperties: null);
        Add(
            withNullCustomizedProperties,
            "workspaceId:,envId:2907cb3a-fff7-47dc-9ceb-7043a3d9a03f,keyId:end-user-key,name:end-user"
        );

        var withCustomizedProperties = new EndUser(
            workspaceId: null,
            envId,
            "end-user-key",
            "end-user",
            new List<EndUserCustomizedProperty>
            {
                new()
                {
                    Name = "key1",
                    Value = "key2"
                },
                new()
                {
                    Name = "key2",
                    Value = "key2"
                }
            }
        );
        Add(
            withCustomizedProperties,
            "workspaceId:,envId:2907cb3a-fff7-47dc-9ceb-7043a3d9a03f,keyId:end-user-key,name:end-user,key1:key2,key2:key2"
        );

        var withEmptyCustomizedProperties = new EndUser(
            workspaceId: null,
            envId,
            "end-user-key",
            "end-user",
            new List<EndUserCustomizedProperty>()
        );
        Add(
            withEmptyCustomizedProperties,
            "workspaceId:,envId:2907cb3a-fff7-47dc-9ceb-7043a3d9a03f,keyId:end-user-key,name:end-user"
        );

        var workspaceId = Guid.Parse("2907cb3a-fff7-47dc-9ceb-7043a3d9a03f");
        var globalUser = new EndUser(workspaceId, envId: null, "global-user-key", "global-user", customizedProperties: null);
        Add(
            globalUser,
            "workspaceId:2907cb3a-fff7-47dc-9ceb-7043a3d9a03f,envId:,keyId:global-user-key,name:global-user"
        );
    }
}