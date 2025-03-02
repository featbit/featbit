using System.Data;
using System.Text.Json;
using Dapper;
using Domain.Utils;

namespace Infrastructure.Persistence.Dapper;

internal class JsonObjectTypeHandler : SqlMapper.ITypeHandler
{
    public void SetValue(IDbDataParameter parameter, object? value)
    {
        parameter.Value = value is null or DBNull
            ? DBNull.Value
            : JsonSerializer.Serialize(value, ReusableJsonSerializerOptions.Web);
        parameter.DbType = DbType.String;
    }

    public object? Parse(Type destinationType, object? value) =>
        value is string str
            ? JsonSerializer.Deserialize(str, destinationType, ReusableJsonSerializerOptions.Web)
            : null;
}