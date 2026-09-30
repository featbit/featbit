using NpgsqlTypes;

namespace MongoToPostgresMigrator.Tests;

/// <summary>
/// Unit tests for <see cref="NpgsqlTypeMap"/>: the store-type → NpgsqlDbType
/// mapping used by the binary COPY writer. Kept DB-free — pure function checks.
/// </summary>
public class NpgsqlTypeMapTests
{
    [Theory]
    [InlineData("uuid", NpgsqlDbType.Uuid)]
    [InlineData("jsonb", NpgsqlDbType.Jsonb)]
    [InlineData("json", NpgsqlDbType.Json)]
    [InlineData("text", NpgsqlDbType.Text)]
    [InlineData("character varying", NpgsqlDbType.Varchar)]
    [InlineData("varchar", NpgsqlDbType.Varchar)]
    [InlineData("timestamp with time zone", NpgsqlDbType.TimestampTz)]
    [InlineData("timestamptz", NpgsqlDbType.TimestampTz)]
    [InlineData("timestamp without time zone", NpgsqlDbType.Timestamp)]
    [InlineData("boolean", NpgsqlDbType.Boolean)]
    [InlineData("bool", NpgsqlDbType.Boolean)]
    [InlineData("integer", NpgsqlDbType.Integer)]
    [InlineData("bigint", NpgsqlDbType.Bigint)]
    [InlineData("smallint", NpgsqlDbType.Smallint)]
    [InlineData("numeric", NpgsqlDbType.Numeric)]
    [InlineData("double precision", NpgsqlDbType.Double)]
    [InlineData("bytea", NpgsqlDbType.Bytea)]
    public void Map_KnownScalarType_ReturnsMatchingNpgsqlType(string storeType, NpgsqlDbType expected)
    {
        Assert.Equal(expected, NpgsqlTypeMap.Map(storeType));
    }

    [Theory]
    [InlineData("character varying(512)", NpgsqlDbType.Varchar)]
    [InlineData("character varying(128)", NpgsqlDbType.Varchar)]
    [InlineData("numeric(10, 2)", NpgsqlDbType.Numeric)]
    public void Map_TypeWithLengthOrPrecision_IgnoresQualifier(string storeType, NpgsqlDbType expected)
    {
        Assert.Equal(expected, NpgsqlTypeMap.Map(storeType));
    }

    [Theory]
    [InlineData("text[]", NpgsqlDbType.Array | NpgsqlDbType.Text)]
    [InlineData("uuid[]", NpgsqlDbType.Array | NpgsqlDbType.Uuid)]
    [InlineData("character varying(64)[]", NpgsqlDbType.Array | NpgsqlDbType.Varchar)]
    public void Map_ArrayType_ReturnsArrayOfElementType(string storeType, NpgsqlDbType expected)
    {
        Assert.Equal(expected, NpgsqlTypeMap.Map(storeType));
    }

    [Theory]
    [InlineData("  UUID  ")]
    [InlineData("JsonB")]
    [InlineData("Character Varying(512)")]
    public void Map_IsCaseAndWhitespaceInsensitive(string storeType)
    {
        // Each of these normalises to a supported type; the point is that mixed
        // case and surrounding whitespace do not cause a NotSupportedException.
        var result = NpgsqlTypeMap.Map(storeType);
        Assert.True(Enum.IsDefined(typeof(NpgsqlDbType), result & ~NpgsqlDbType.Array));
    }

    [Theory]
    [InlineData("geometry")]
    [InlineData("hstore")]
    [InlineData("")]
    public void Map_UnknownType_ThrowsNotSupported(string storeType)
    {
        var ex = Assert.Throws<NotSupportedException>(() => NpgsqlTypeMap.Map(storeType));
        Assert.Contains("no NpgsqlDbType mapping", ex.Message);
    }
}
