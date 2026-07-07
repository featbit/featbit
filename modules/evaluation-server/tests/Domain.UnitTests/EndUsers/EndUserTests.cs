using Domain.EndUsers;

namespace Domain.UnitTests.EndUsers;

public class EndUserTests
{
    [Theory]
    [ClassData(typeof(EndUserIsValidData))]
    public void IsValid_ReturnsExpected(EndUser user, bool expected)
        => Assert.Equal(expected, user.IsValid());

    [Theory]
    [ClassData(typeof(EndUserValueOfData))]
    public void ValueOf_ReturnsExpected(EndUser user, string? property, string expected)
        => Assert.Equal(expected, user.ValueOf(property));
}

public class EndUserIsValidData : TheoryData<EndUser, bool>
{
    public EndUserIsValidData()
    {
        // Invalid
        Add(new EndUser { KeyId = null, Name = "user" }, false);
        Add(new EndUser { KeyId = "", Name = "user" }, false);
        Add(new EndUser { KeyId = new string('a', 257), Name = "user" }, false);
        Add(new EndUser { KeyId = "key", Name = new string('a', 257) }, false);
        Add(new EndUser { KeyId = "key", Name = "user", CustomizedProperties = [new CustomizedProperty { Name = "", Value = "v" }] }, false);

        // Valid
        Add(new EndUser { KeyId = "key", Name = "user", CustomizedProperties = [new CustomizedProperty { Name = "prop", Value = "val" }] }, true);
        Add(new EndUser { KeyId = "key", Name = null }, true);
        Add(new EndUser { KeyId = "key", CustomizedProperties = null }, true);
        Add(new EndUser { KeyId = new string('a', 256) }, true);
    }
}

public class EndUserValueOfData : TheoryData<EndUser, string?, string>
{
    public EndUserValueOfData()
    {
        var baseUser = new EndUser { KeyId = "key", Name = "user" };
        Add(baseUser, null, string.Empty);
        Add(baseUser, "  ", string.Empty);
        Add(new EndUser { KeyId = "my-key", Name = "user" }, EndUserConsts.KeyId, "my-key");
        Add(new EndUser { KeyId = "key", Name = "my-name" }, EndUserConsts.Name, "my-name");

        var userWithProps = new EndUser { KeyId = "key", CustomizedProperties = [new CustomizedProperty { Name = "country", Value = "US" }] };
        Add(userWithProps, "country", "US");
        Add(userWithProps, "city", string.Empty);
        Add(new EndUser { KeyId = "key", CustomizedProperties = null }, "country", string.Empty);
    }
}