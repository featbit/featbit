using Domain.Bases;
using Microsoft.Extensions.Logging.Abstractions;
using MongoDB.Bson;

namespace MongoToPostgresMigrator.Tests;

/// <summary>
/// Unit tests for <see cref="EntityStep{T}.RepairNonUuidId"/>: FeatBit entities
/// key on a <see cref="Guid"/>, so a document whose <c>_id</c> is not a UUID must
/// be given a fresh one (and counted) rather than aborting the copy. DB-free —
/// the method operates on a raw <see cref="BsonDocument"/> only.
/// </summary>
public class RepairNonUuidIdTests
{
    private sealed class FakeEntity : Entity;

    // Exposes the protected RepairNonUuidId for testing.
    private sealed class TestableStep() : EntityStep<FakeEntity>("Fake")
    {
        public void Repair(MigrationContext ctx, BsonDocument doc) => RepairNonUuidId(ctx, doc);
    }

    private static MigrationContext CreateContext() =>
        new(mongo: null!, db: null!, dataSource: null!, batchSize: 0, logger: NullLogger.Instance);

    [Fact]
    public void Repair_StandardUuidId_IsLeftUnchanged()
    {
        var ctx = CreateContext();
        var id = new BsonBinaryData(Guid.NewGuid(), GuidRepresentation.Standard);
        var doc = new BsonDocument("_id", id);

        new TestableStep().Repair(ctx, doc);

        Assert.Equal(id, doc["_id"]);
        Assert.Equal(0, ctx.ReassignedIds);
    }

    [Fact]
    public void Repair_LegacyUuidId_IsLeftUnchanged()
    {
        var ctx = CreateContext();
        var id = new BsonBinaryData(Guid.NewGuid(), GuidRepresentation.CSharpLegacy);
        var doc = new BsonDocument("_id", id);

        new TestableStep().Repair(ctx, doc);

        Assert.Equal(BsonBinarySubType.UuidLegacy, doc["_id"].AsBsonBinaryData.SubType);
        Assert.Equal(0, ctx.ReassignedIds);
    }

    [Fact]
    public void Repair_ObjectIdId_IsReassignedToAFreshUuid()
    {
        var ctx = CreateContext();
        var doc = new BsonDocument("_id", new BsonObjectId(ObjectId.GenerateNewId()));

        new TestableStep().Repair(ctx, doc);

        Assert.Equal(BsonType.Binary, doc["_id"].BsonType);
        Assert.Equal(BsonBinarySubType.UuidStandard, doc["_id"].AsBsonBinaryData.SubType);
        Assert.Equal(1, ctx.ReassignedIds);
    }

    [Fact]
    public void Repair_MissingId_IsANoOp()
    {
        var ctx = CreateContext();
        var doc = new BsonDocument("name", "no id here");

        new TestableStep().Repair(ctx, doc);

        Assert.False(doc.Contains("_id"));
        Assert.Equal(0, ctx.ReassignedIds);
    }

    [Fact]
    public void Repair_EachNonUuid_IncrementsTheSharedCounter()
    {
        var ctx = CreateContext();
        var step = new TestableStep();

        step.Repair(ctx, new BsonDocument("_id", new BsonObjectId(ObjectId.GenerateNewId())));
        step.Repair(ctx, new BsonDocument("_id", new BsonInt32(42)));

        Assert.Equal(2, ctx.ReassignedIds);
    }
}
