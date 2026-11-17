using Domain.Users;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Services.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.IntegrationTests.Services.EntityFrameworkCore;

[Collection(FeatBitPostgresCollection.Name)]
public class UserServiceTests(FeatBitPostgresFixture fixture) : IntegrationTestBase
{
    [DockerTheory]
    [InlineData("", "test.user@example.com")]
    [InlineData("   ", "test.user@example.com")]
    [InlineData("Test User", "Test User")]
    public async Task GetOperatorAsync_ReloadedUser_PreservesStoredName(string name, string expectedOperator)
    {
        var user = new User("test.user@example.com", "password");
        Assert.Equal("test.user", user.Name);
        user.Name = name;

        await using (var writeDb = AppDbContextFactory.Create(fixture.ConnectionString))
        {
            await new UserService(writeDb).AddOneAsync(user);
        }

        await using var readDb = AppDbContextFactory.Create(fixture.ConnectionString);
        try
        {
            var loaded = await readDb.Set<User>().SingleAsync(x => x.Id == user.Id);
            Assert.Equal(name, loaded.Name);
            Assert.Equal(expectedOperator,
                await new UserService(readDb).GetOperatorAsync(user.Id));
        }
        finally
        {
            await readDb.Set<User>().Where(x => x.Id == user.Id).ExecuteDeleteAsync();
        }
    }
}
