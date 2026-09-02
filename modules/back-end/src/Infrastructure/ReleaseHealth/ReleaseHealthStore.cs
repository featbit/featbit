using Application.Bases.Exceptions;
using Application.ReleaseHealth;
using MongoDB.Driver;
using Npgsql;

namespace Infrastructure.ReleaseHealth;

public sealed class PostgresReleaseHealthStore(NpgsqlDataSource database) : IReleaseHealthStore
{
    public async Task<IReadOnlyList<ReleaseHealthDocument>> ListAsync(Guid scopeId, string kind, CancellationToken ct)
    {
        await using var command = database.CreateCommand("SELECT id, scope_id, project_id, kind, natural_key, version, payload, protected_secrets FROM release_health_documents WHERE scope_id=$1 AND kind=$2 ORDER BY natural_key LIMIT 500");
        command.Parameters.AddWithValue(scopeId);
        command.Parameters.AddWithValue(kind);
        await using var reader = await command.ExecuteReaderAsync(ct);
        List<ReleaseHealthDocument> result = [];
        while (await reader.ReadAsync(ct)) result.Add(Read(reader));
        return result;
    }
    public async Task<ReleaseHealthDocument?> FindAsync(Guid scopeId, string kind, Guid id, CancellationToken ct)
    {
        await using var command = database.CreateCommand("SELECT id, scope_id, project_id, kind, natural_key, version, payload, protected_secrets FROM release_health_documents WHERE scope_id=$1 AND kind=$2 AND id=$3");
        command.Parameters.AddWithValue(scopeId);
        command.Parameters.AddWithValue(kind);
        command.Parameters.AddWithValue(id);
        await using var reader = await command.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? Read(reader) : null;
    }
    private static ReleaseHealthDocument Read(NpgsqlDataReader reader) => new(reader.GetGuid(0), reader.GetGuid(1), reader.GetGuid(2), reader.GetString(3), reader.GetString(4), reader.GetInt64(5), reader.GetString(6), reader.IsDBNull(7) ? null : reader.GetString(7));
    public async Task PutAsync(ReleaseHealthDocument document, long? expectedVersion, CancellationToken ct)
    {
        var sql = expectedVersion is null
            ? "INSERT INTO release_health_documents (id,scope_id,project_id,kind,natural_key,version,payload,protected_secrets) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)"
            : "UPDATE release_health_documents SET project_id=$3,natural_key=$5,version=$6,payload=$7,protected_secrets=$8 WHERE id=$1 AND scope_id=$2 AND kind=$4 AND version=$9";
        await using var command = database.CreateCommand(sql);
        command.Parameters.AddWithValue(document.Id);
        command.Parameters.AddWithValue(document.ScopeId);
        command.Parameters.AddWithValue(document.ProjectId);
        command.Parameters.AddWithValue(document.Kind);
        command.Parameters.AddWithValue(document.NaturalKey);
        command.Parameters.AddWithValue(document.Version);
        command.Parameters.AddWithValue(document.Payload);
        command.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlTypes.NpgsqlDbType.Text, Value = (object?)document.ProtectedSecrets ?? DBNull.Value });
        if (expectedVersion is not null) command.Parameters.AddWithValue(expectedVersion.Value);
        try
        {
            if (await command.ExecuteNonQueryAsync(ct) != 1) throw new ConflictException("ReleaseHealth", document.Id);
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        { throw new ConflictException("ReleaseHealth", document.Id); }
    }
}

public sealed class MongoReleaseHealthStore(MongoDbClient database) : IReleaseHealthStore
{
    // Compound natural-key identity makes create uniqueness atomic without background index creation.
    private sealed class Stored
    {
        public string Id { get; set; } = "";
        public string ScopeId { get; set; } = "";
        public string EntityId { get; set; } = "";
        public string Kind { get; set; } = "";
        public long Version { get; set; }
        public string Document { get; set; } = "";
    }
    private IMongoCollection<Stored> Collection => database.Database.GetCollection<Stored>("ReleaseHealthDocuments");
    public async Task<IReadOnlyList<ReleaseHealthDocument>> ListAsync(Guid scopeId, string kind, CancellationToken ct)
    {
        var values = await Collection.Find(x => x.ScopeId == scopeId.ToString() && x.Kind == kind).Limit(500).ToListAsync(ct);
        return values.Select(x => System.Text.Json.JsonSerializer.Deserialize<ReleaseHealthDocument>(x.Document)!).ToArray();
    }
    public async Task<ReleaseHealthDocument?> FindAsync(Guid scopeId, string kind, Guid id, CancellationToken ct)
    {
        var value = await Collection.Find(x => x.ScopeId == scopeId.ToString() && x.Kind == kind && x.EntityId == id.ToString()).FirstOrDefaultAsync(ct);
        return value is null ? null : System.Text.Json.JsonSerializer.Deserialize<ReleaseHealthDocument>(value.Document);
    }
    public async Task PutAsync(ReleaseHealthDocument document, long? expectedVersion, CancellationToken ct)
    {
        var stored = new Stored { Id = $"{document.ScopeId}:{document.Kind}:{document.NaturalKey}", ScopeId = document.ScopeId.ToString(), EntityId = document.Id.ToString(), Kind = document.Kind, Version = document.Version, Document = System.Text.Json.JsonSerializer.Serialize(document) };
        try
        {
            if (expectedVersion is null) await Collection.InsertOneAsync(stored, cancellationToken: ct);
            else
            {
                var result = await Collection.ReplaceOneAsync(x => x.Id == stored.Id && x.Version == expectedVersion.Value && x.EntityId == stored.EntityId, stored, cancellationToken: ct);
                if (result.MatchedCount != 1) throw new ConflictException("ReleaseHealth", document.Id);
            }
        }
        catch (MongoWriteException ex) when (ex.WriteError.Category == ServerErrorCategory.DuplicateKey)
        { throw new ConflictException("ReleaseHealth", document.Id); }
    }
}
