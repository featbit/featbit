using NpgsqlTypes;

namespace MongoToPostgresMigrator;

/// <summary>
/// Maps a PostgreSQL store type (as EF Core reports it) to the matching
/// <see cref="NpgsqlDbType"/> used by the binary COPY writer. Kept separate from
/// <see cref="BulkCopyStep{T}"/> so the mapping is a small, pure function that is
/// easy to read and unit-test in isolation.
/// </summary>
internal static class NpgsqlTypeMap
{
    /// <summary>
    /// Maps a store type such as <c>timestamp with time zone</c> or
    /// <c>character varying(512)</c> to its <see cref="NpgsqlDbType"/>. Length and
    /// precision qualifiers are ignored and a trailing <c>[]</c> is treated as an
    /// array of the element type. An unrecognised type throws
    /// <see cref="NotSupportedException"/> at setup — before any data is written —
    /// so an unhandled column fails fast instead of silently writing the wrong
    /// binary representation.
    /// </summary>
    public static NpgsqlDbType Map(string storeType)
    {
        var normalized = storeType.Trim().ToLowerInvariant();

        // Strip the array suffix first, then the length/precision qualifier —
        // otherwise a type like "character varying(64)[]" would lose its "[]"
        // when everything after the "(" is dropped.
        var isArray = normalized.EndsWith("[]", StringComparison.Ordinal);
        if (isArray)
        {
            normalized = normalized[..^2].Trim();
        }

        // Drop any length/precision qualifier, e.g. character varying(512).
        var parenIndex = normalized.IndexOf('(');
        if (parenIndex >= 0)
        {
            normalized = normalized[..parenIndex].Trim();
        }

        var baseType = normalized switch
        {
            "uuid" => NpgsqlDbType.Uuid,
            "jsonb" => NpgsqlDbType.Jsonb,
            "json" => NpgsqlDbType.Json,
            "text" => NpgsqlDbType.Text,
            "character varying" or "varchar" => NpgsqlDbType.Varchar,
            "character" or "char" or "bpchar" => NpgsqlDbType.Char,
            "timestamp with time zone" or "timestamptz" => NpgsqlDbType.TimestampTz,
            "timestamp without time zone" or "timestamp" => NpgsqlDbType.Timestamp,
            "date" => NpgsqlDbType.Date,
            "boolean" or "bool" => NpgsqlDbType.Boolean,
            "smallint" or "int2" => NpgsqlDbType.Smallint,
            "integer" or "int" or "int4" => NpgsqlDbType.Integer,
            "bigint" or "int8" => NpgsqlDbType.Bigint,
            "numeric" or "decimal" => NpgsqlDbType.Numeric,
            "real" or "float4" => NpgsqlDbType.Real,
            "double precision" or "float8" => NpgsqlDbType.Double,
            "bytea" => NpgsqlDbType.Bytea,
            _ => throw new NotSupportedException(
                $"The generic COPY writer has no NpgsqlDbType mapping for PostgreSQL type '{storeType}'. " +
                "Add it to NpgsqlTypeMap or migrate this entity with the EF Core path.")
        };

        return isArray ? NpgsqlDbType.Array | baseType : baseType;
    }
}
