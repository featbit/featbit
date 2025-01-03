using Domain.Resources;

namespace Domain.UnitTests.Resources;

public class RNTests
{
    [Fact]
    public void ValidRN()
    {
        List<KeyValuePair<string, TypeKeyProps[]>> testData =
        [
            new(
                "organization/o",
                [
                    new TypeKeyProps { Type = ResourceTypes.Organization, Key = "o" }
                ]
            ),
            new(
                "organization/*",
                [
                    new TypeKeyProps { Type = ResourceTypes.Organization, Key = "*" }
                ]
            ),
            new(
                "organization/o:project/p",
                [
                    new TypeKeyProps { Type = ResourceTypes.Organization, Key = "o" },
                    new TypeKeyProps { Type = ResourceTypes.Project, Key = "p" }
                ]
            ),
            new(
                "organization/o:project/p:env/e",
                [
                    new TypeKeyProps { Type = ResourceTypes.Organization, Key = "o" },
                    new TypeKeyProps { Type = ResourceTypes.Project, Key = "p" },
                    new TypeKeyProps { Type = ResourceTypes.Env, Key = "e" }
                ]
            ),
            new(
                "organization/o:project/p:env/*",
                [
                    new TypeKeyProps { Type = ResourceTypes.Organization, Key = "o" },
                    new TypeKeyProps { Type = ResourceTypes.Project, Key = "p" },
                    new TypeKeyProps { Type = ResourceTypes.Env, Key = "*" }
                ]
            )
        ];

        foreach (var data in testData)
        {
            var success = RN.TryParse(data.Key, out var actual);

            Assert.True(success);
            Assert.NotNull(actual);
            Assert.True(actual.SequenceEqual(data.Value));
        }
    }

    [Theory]
    [InlineData("")]
    [InlineData("/")]
    [InlineData(null)]
    [InlineData("abc")]
    [InlineData("organization")]
    [InlineData("organization/")]
    public void InvalidRN(string? rnString)
    {
        var success = RN.TryParse(rnString, out _);
        Assert.False(success);
    }
}