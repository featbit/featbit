using Domain.EndUsers;

namespace Domain.UnitTests.EndUsers;

public class CustomizedPropertyTests
{
    [Theory]
    [ClassData(typeof(CustomizedPropertyIsValidData))]
    public void IsValid_ReturnsExpected(CustomizedProperty prop, bool expected)
        => Assert.Equal(expected, prop.IsValid());
}

public class CustomizedPropertyIsValidData : TheoryData<CustomizedProperty, bool>
{
    public CustomizedPropertyIsValidData()
    {
        // Invalid: null/empty/whitespace name
        Add(new CustomizedProperty { Name = null, Value = "v" }, false);
        Add(new CustomizedProperty { Name = "", Value = "v" }, false);
        Add(new CustomizedProperty { Name = "   ", Value = "v" }, false);

        // Invalid: name too long
        Add(new CustomizedProperty { Name = new string('a', 129), Value = "v" }, false);

        // Invalid: leading/trailing spaces
        Add(new CustomizedProperty { Name = " prop", Value = "v" }, false);
        Add(new CustomizedProperty { Name = "prop ", Value = "v" }, false);
        Add(new CustomizedProperty { Name = " prop ", Value = "v" }, false);

        // Invalid: disallowed characters
        Add(new CustomizedProperty { Name = "invalid@name!", Value = "v" }, false);
        Add(new CustomizedProperty { Name = "prop/name", Value = "v" }, false);
        Add(new CustomizedProperty { Name = "prop#1", Value = "v" }, false);

        // Invalid: value too long
        Add(new CustomizedProperty { Name = "prop", Value = new string('a', 2049) }, false);

        // Valid: basic cases
        Add(new CustomizedProperty { Name = "prop", Value = null }, true);
        Add(new CustomizedProperty { Name = "my-prop_name.1", Value = "val" }, true);
        Add(new CustomizedProperty { Name = new string('a', 128), Value = "v" }, true);

        // Valid: colon allowed
        Add(new CustomizedProperty { Name = "custom:role", Value = "admin" }, true);
        Add(new CustomizedProperty { Name = "ns:sub:prop", Value = "v" }, true);

        // Valid: space in the middle
        Add(new CustomizedProperty { Name = "my prop", Value = "v" }, true);

        // Valid: max-length value
        Add(new CustomizedProperty { Name = "prop", Value = new string('a', 2048) }, true);
    }
}