using System.Text;
using System.Text.Json;
using MongoDB.Bson;
using StackExchange.Redis;

namespace Infrastructure.Caches;


public class FakeRedisService: IRedisService
{
    private readonly List<string> _fakeFeatureFlags = new List<string>()
    {
        "{\"envId\":\"e4d78ba7-d74d-4833-82d5-d1c98283d1fc\",\"name\":\"perf-loading-test-003\",\"key\":\"perf-loading-test-003\",\"variationType\":\"boolean\",\"variations\":[{\"id\":\"97bb1c2d-7673-4d0c-b83a-4d5b5722c0e4\",\"value\":\"true\"},{\"id\":\"fe349abf-bb40-4b87-bd65-58c638b72a2b\",\"value\":\"false\"}],\"targetUsers\":[],\"rules\":[],\"isEnabled\":false,\"disabledVariationId\":\"fe349abf-bb40-4b87-bd65-58c638b72a2b\",\"fallthrough\":{\"includedInExpt\":true,\"variations\":[{\"id\":\"97bb1c2d-7673-4d0c-b83a-4d5b5722c0e4\",\"rollout\":[0,1],\"exptRollout\":1}]},\"exptIncludeAllTargets\":true,\"tags\":[],\"isArchived\":false,\"disabledVariation\":{\"id\":\"fe349abf-bb40-4b87-bd65-58c638b72a2b\",\"value\":\"false\"},\"creatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"updatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"createdAt\":\"2022-12-09T05:25:37.7587393Z\",\"updatedAt\":\"2022-12-09T05:25:37.7587393Z\",\"id\":\"e9d599db-e4d2-4ca5-a293-af6600596fcf\"}",
        "{\"envId\":\"e4d78ba7-d74d-4833-82d5-d1c98283d1fc\",\"name\":\"perf-loading-test-008\",\"key\":\"perf-loading-test-008\",\"variationType\":\"boolean\",\"variations\":[{\"id\":\"ea75f1c9-af9b-43de-bdbe-926f9dae77dc\",\"value\":\"true\"},{\"id\":\"ed5330dd-d6e2-4c3e-b4c5-643d04076a7a\",\"value\":\"false\"}],\"targetUsers\":[],\"rules\":[],\"isEnabled\":true,\"disabledVariationId\":\"ed5330dd-d6e2-4c3e-b4c5-643d04076a7a\",\"fallthrough\":{\"includedInExpt\":true,\"variations\":[{\"id\":\"ea75f1c9-af9b-43de-bdbe-926f9dae77dc\",\"rollout\":[0,1],\"exptRollout\":1}]},\"exptIncludeAllTargets\":true,\"tags\":[],\"isArchived\":false,\"disabledVariation\":{\"id\":\"ed5330dd-d6e2-4c3e-b4c5-643d04076a7a\",\"value\":\"false\"},\"creatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"updatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"createdAt\":\"2022-12-09T05:26:08.79Z\",\"updatedAt\":\"2022-12-09T06:26:06.3765696Z\",\"id\":\"08a652e1-75be-4c8b-97d0-af660059942d\"}",
        "{\"envId\":\"e4d78ba7-d74d-4833-82d5-d1c98283d1fc\",\"name\":\"perf-loading-test-009\",\"key\":\"perf-loading-test-009\",\"variationType\":\"boolean\",\"variations\":[{\"id\":\"4bae3000-35e0-4921-a69c-bc3db8c56f73\",\"value\":\"true\"},{\"id\":\"d2e18a9e-24d2-44ab-8fc0-6717c116140e\",\"value\":\"false\"}],\"targetUsers\":[],\"rules\":[],\"isEnabled\":true,\"disabledVariationId\":\"d2e18a9e-24d2-44ab-8fc0-6717c116140e\",\"fallthrough\":{\"includedInExpt\":true,\"variations\":[{\"id\":\"4bae3000-35e0-4921-a69c-bc3db8c56f73\",\"rollout\":[0,1],\"exptRollout\":1}]},\"exptIncludeAllTargets\":true,\"tags\":[],\"isArchived\":false,\"disabledVariation\":{\"id\":\"d2e18a9e-24d2-44ab-8fc0-6717c116140e\",\"value\":\"false\"},\"creatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"updatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"createdAt\":\"2022-12-09T05:26:13.675Z\",\"updatedAt\":\"2022-12-09T06:26:08.2322046Z\",\"id\":\"e89f1277-900c-4a50-b8db-af66005999e6\"}",
        "{\"envId\":\"e4d78ba7-d74d-4833-82d5-d1c98283d1fc\",\"name\":\"perf-loading-test-010\",\"key\":\"perf-loading-test-010\",\"variationType\":\"boolean\",\"variations\":[{\"id\":\"1cfaa385-cd2b-4378-b0de-5ce5fe4da097\",\"value\":\"true\"},{\"id\":\"3f15fdc4-dc68-499c-97ee-755f3b44f24a\",\"value\":\"false\"}],\"targetUsers\":[],\"rules\":[],\"isEnabled\":true,\"disabledVariationId\":\"3f15fdc4-dc68-499c-97ee-755f3b44f24a\",\"fallthrough\":{\"includedInExpt\":true,\"variations\":[{\"id\":\"1cfaa385-cd2b-4378-b0de-5ce5fe4da097\",\"rollout\":[0,1],\"exptRollout\":1}]},\"exptIncludeAllTargets\":true,\"tags\":[],\"isArchived\":false,\"disabledVariation\":{\"id\":\"3f15fdc4-dc68-499c-97ee-755f3b44f24a\",\"value\":\"false\"},\"creatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"updatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"createdAt\":\"2022-12-09T05:26:20.057Z\",\"updatedAt\":\"2022-12-09T06:26:09.8090138Z\",\"id\":\"de28f9e9-1ab4-4923-9f0e-af660059a161\"}",
        "{\"envId\":\"e4d78ba7-d74d-4833-82d5-d1c98283d1fc\",\"name\":\"perf-loading-test-005\",\"key\":\"perf-loading-test-005\",\"variationType\":\"boolean\",\"variations\":[{\"id\":\"b6ef19a4-447c-4607-9b80-0c329076f275\",\"value\":\"true\"},{\"id\":\"fd39539b-d737-4937-b17b-09c5e742cbe1\",\"value\":\"false\"}],\"targetUsers\":[],\"rules\":[],\"isEnabled\":true,\"disabledVariationId\":\"fd39539b-d737-4937-b17b-09c5e742cbe1\",\"fallthrough\":{\"includedInExpt\":true,\"variations\":[{\"id\":\"b6ef19a4-447c-4607-9b80-0c329076f275\",\"rollout\":[0,1],\"exptRollout\":1}]},\"exptIncludeAllTargets\":true,\"tags\":[],\"isArchived\":false,\"disabledVariation\":{\"id\":\"fd39539b-d737-4937-b17b-09c5e742cbe1\",\"value\":\"false\"},\"creatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"updatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"createdAt\":\"2022-12-09T05:25:49.592Z\",\"updatedAt\":\"2022-12-09T06:26:13.680763Z\",\"id\":\"60dbfe19-a30d-40ca-b064-af6600597dad\"}",
        "{\"envId\":\"e4d78ba7-d74d-4833-82d5-d1c98283d1fc\",\"name\":\"perf-loading-test-006\",\"key\":\"perf-loading-test-006\",\"variationType\":\"boolean\",\"variations\":[{\"id\":\"72f388c3-3797-4155-b90b-16396639966a\",\"value\":\"true\"},{\"id\":\"87b50b27-1eb8-4a92-9534-92d347de33d7\",\"value\":\"false\"}],\"targetUsers\":[],\"rules\":[],\"isEnabled\":true,\"disabledVariationId\":\"87b50b27-1eb8-4a92-9534-92d347de33d7\",\"fallthrough\":{\"includedInExpt\":true,\"variations\":[{\"id\":\"72f388c3-3797-4155-b90b-16396639966a\",\"rollout\":[0,1],\"exptRollout\":1}]},\"exptIncludeAllTargets\":true,\"tags\":[],\"isArchived\":false,\"disabledVariation\":{\"id\":\"87b50b27-1eb8-4a92-9534-92d347de33d7\",\"value\":\"false\"},\"creatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"updatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"createdAt\":\"2022-12-09T05:25:55.542Z\",\"updatedAt\":\"2022-12-09T06:26:15.4954978Z\",\"id\":\"5a77c4f8-a7bd-4331-b222-af66005984a6\"}",
        "{\"envId\":\"e4d78ba7-d74d-4833-82d5-d1c98283d1fc\",\"name\":\"perf-loading-test-007\",\"key\":\"perf-loading-test-007\",\"variationType\":\"boolean\",\"variations\":[{\"id\":\"cbfe1603-2c82-4bf6-8619-19d201084bce\",\"value\":\"true\"},{\"id\":\"6af5fc3e-3eb5-4b46-935b-383c2ecea767\",\"value\":\"false\"}],\"targetUsers\":[],\"rules\":[],\"isEnabled\":true,\"disabledVariationId\":\"6af5fc3e-3eb5-4b46-935b-383c2ecea767\",\"fallthrough\":{\"includedInExpt\":true,\"variations\":[{\"id\":\"cbfe1603-2c82-4bf6-8619-19d201084bce\",\"rollout\":[0,1],\"exptRollout\":1}]},\"exptIncludeAllTargets\":true,\"tags\":[],\"isArchived\":false,\"disabledVariation\":{\"id\":\"6af5fc3e-3eb5-4b46-935b-383c2ecea767\",\"value\":\"false\"},\"creatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"updatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"createdAt\":\"2022-12-09T05:26:02.822Z\",\"updatedAt\":\"2022-12-09T06:26:16.9598004Z\",\"id\":\"d5fcce13-0ffc-44d6-9e4c-af6600598d2e\"}",
        "{\"envId\":\"e4d78ba7-d74d-4833-82d5-d1c98283d1fc\",\"name\":\"perf-loading-test-001\",\"key\":\"perf-loading-test-001\",\"variationType\":\"boolean\",\"variations\":[{\"id\":\"2f3cafef-5b1c-4511-a405-0418efa7a5c8\",\"value\":\"true\"},{\"id\":\"e325e9fa-882e-4e30-926a-4218fc7b466c\",\"value\":\"false\"}],\"targetUsers\":[],\"rules\":[],\"isEnabled\":false,\"disabledVariationId\":\"e325e9fa-882e-4e30-926a-4218fc7b466c\",\"fallthrough\":{\"includedInExpt\":true,\"variations\":[{\"id\":\"2f3cafef-5b1c-4511-a405-0418efa7a5c8\",\"rollout\":[0,1],\"exptRollout\":1}]},\"exptIncludeAllTargets\":true,\"tags\":[],\"isArchived\":false,\"disabledVariation\":{\"id\":\"e325e9fa-882e-4e30-926a-4218fc7b466c\",\"value\":\"false\"},\"creatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"updatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"createdAt\":\"2022-12-09T05:25:24.384Z\",\"updatedAt\":\"2022-12-09T06:26:18.8432162Z\",\"id\":\"fb226a94-8ad7-48c0-a5e8-af6600596023\"}",
        "{\"envId\":\"e4d78ba7-d74d-4833-82d5-d1c98283d1fc\",\"name\":\"perf-loading-test-002\",\"key\":\"perf-loading-test-002\",\"variationType\":\"boolean\",\"variations\":[{\"id\":\"ebb6e37e-e15c-4c29-bdb2-2bff0ee4fc2d\",\"value\":\"true\"},{\"id\":\"ac5bccc8-3ca1-4c8d-9866-7cc2afcc4292\",\"value\":\"false\"}],\"targetUsers\":[{\"keyIds\":[],\"variationId\":\"ebb6e37e-e15c-4c29-bdb2-2bff0ee4fc2d\"},{\"keyIds\":[],\"variationId\":\"ac5bccc8-3ca1-4c8d-9866-7cc2afcc4292\"}],\"rules\":[],\"isEnabled\":true,\"disabledVariationId\":\"ac5bccc8-3ca1-4c8d-9866-7cc2afcc4292\",\"fallthrough\":{\"includedInExpt\":true,\"variations\":[{\"id\":\"ebb6e37e-e15c-4c29-bdb2-2bff0ee4fc2d\",\"rollout\":[0,0.1],\"exptRollout\":0},{\"id\":\"ac5bccc8-3ca1-4c8d-9866-7cc2afcc4292\",\"rollout\":[0.1,1],\"exptRollout\":0}]},\"exptIncludeAllTargets\":true,\"tags\":[],\"isArchived\":false,\"disabledVariation\":{\"id\":\"ac5bccc8-3ca1-4c8d-9866-7cc2afcc4292\",\"value\":\"false\"},\"creatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"updatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"createdAt\":\"2022-12-09T05:25:31.735Z\",\"updatedAt\":\"2022-12-09T06:26:39.2371664Z\",\"id\":\"cfc96b55-07dd-4454-a5ef-af66005968c0\"}",
        "{\"envId\":\"e4d78ba7-d74d-4833-82d5-d1c98283d1fc\",\"name\":\"perf-loading-test-004\",\"key\":\"perf-loading-test-004\",\"variationType\":\"string\",\"variations\":[{\"id\":\"f237c267-c320-4535-b69e-b87d08138457\",\"value\":\"v1\"},{\"id\":\"407b29a1-1566-47ab-8e90-80337b941439\",\"value\":\"v2\"},{\"id\":\"a071348f-6eb8-4ed5-88a8-c53497762fdf\",\"value\":\"v3\"}],\"targetUsers\":[{\"keyIds\":[],\"variationId\":\"f237c267-c320-4535-b69e-b87d08138457\"},{\"keyIds\":[],\"variationId\":\"407b29a1-1566-47ab-8e90-80337b941439\"},{\"keyIds\":[],\"variationId\":\"a071348f-6eb8-4ed5-88a8-c53497762fdf\"}],\"rules\":[],\"isEnabled\":true,\"disabledVariationId\":\"407b29a1-1566-47ab-8e90-80337b941439\",\"fallthrough\":{\"includedInExpt\":true,\"variations\":[{\"id\":\"f237c267-c320-4535-b69e-b87d08138457\",\"rollout\":[0,0.1],\"exptRollout\":0},{\"id\":\"407b29a1-1566-47ab-8e90-80337b941439\",\"rollout\":[0.1,0.30000000000000004],\"exptRollout\":0},{\"id\":\"a071348f-6eb8-4ed5-88a8-c53497762fdf\",\"rollout\":[0.30000000000000004,1],\"exptRollout\":0}]},\"exptIncludeAllTargets\":true,\"tags\":[],\"isArchived\":false,\"disabledVariation\":{\"id\":\"407b29a1-1566-47ab-8e90-80337b941439\",\"value\":\"v2\"},\"creatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"updatorId\":\"4526975f-4f6b-4420-9dde-84c276148832\",\"createdAt\":\"2022-12-09T05:25:44.561Z\",\"updatedAt\":\"2022-12-09T06:27:04.9814513Z\",\"id\":\"829a8953-1f46-4866-aa7e-af66005977c8\"}"
    };

    public FakeRedisService()
    {        
    }

    public async Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp)
    {
        var jsonBytes = _fakeFeatureFlags.Select(x => Encoding.ASCII.GetBytes(x));
        return jsonBytes;
    }

    public async Task<IEnumerable<byte[]>> GetFlagsAsync(IEnumerable<string> ids)
    {
        var jsonBytes = _fakeFeatureFlags.Select(x => Encoding.ASCII.GetBytes(x));
        return jsonBytes;
    }

    public async Task UpsertFlagAsync(JsonElement flag)
    {
    }

    public async Task DeleteFlagAsync(Guid envId, Guid flagId)
    {
    }

    public async Task<byte[]> GetSegmentAsync(string id)
    {
        var value = new RedisValue();
        return (byte[])value!;
    }

    public async Task<IEnumerable<byte[]>> GetSegmentsAsync(Guid envId, long timestamp)
    {
        var values = new List<RedisValue>();
        var jsonBytes = values.Select(x => (byte[])x!);

        return jsonBytes;
    }

    public async Task UpsertSegmentAsync(BsonDocument segment)
    {
    }

    public async Task UpsertSegmentAsync(JsonElement segment)
    {
    }

    public async Task DeleteSegmentAsync(Guid envId, Guid segmentId)
    {
    }
}