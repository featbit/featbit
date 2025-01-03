using Application.Bases;
using Application.Bases.Exceptions;
using Domain.Resources;
using Domain.Segments;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Driver;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.Segments;

public class SegmentAppService : ISegmentAppService
{
    private readonly MongoDbClient _mongodb;
    private readonly ILogger<SegmentAppService> _logger;

    public SegmentAppService(MongoDbClient mongodb, ILogger<SegmentAppService> logger)
    {
        _logger = logger;
        _mongodb = mongodb;
    }

    public async Task<ICollection<Guid>> GetEnvironmentIdsAsync(Segment segment)
    {
        if (segment.IsEnvironmentSpecific)
        {
            return [segment.EnvId];
        }

        var envIds = new List<Guid>();
        foreach (var scope in segment.Scopes)
        {
            var scopeEnvIds = await SearchScope(scope);
            envIds.AddRange(scopeEnvIds);
        }

        return envIds;

        async Task<ICollection<Guid>> SearchScope(string scope)
        {
            if (!RN.TryParse(scope, out var props))
            {
                _logger.LogError(
                    "Inconsistent segment data for {Segment}: the scope '{Scope}' is not a valid RN.",
                    segment.Id,
                    scope
                );

                throw new BusinessException(ErrorCodes.InconsistentData);
            }

            var match = new Dictionary<string, string>();

            var envProp = props.FirstOrDefault(x => x.Type == ResourceTypes.Env);
            if (envProp != null && envProp.Key != "*")
            {
                match.Add("key", envProp.Key);
            }

            var projectProp = props.FirstOrDefault(x => x.Type == ResourceTypes.Project);
            if (projectProp != null && projectProp.Key != "*")
            {
                match.Add("projects.key", projectProp.Key);
            }

            var orgProp = props.FirstOrDefault(x => x.Type == ResourceTypes.Organization);
            if (orgProp != null && orgProp.Key != "*")
            {
                match.Add("organizations.key", orgProp.Key);
            }

            var query = _mongodb.CollectionOf<Environment>().Aggregate()
                .Lookup("Projects", "projectId", "_id", "projects")
                .Unwind("projects")
                .Lookup("Organizations", "projects.organizationId", "_id", "organizations")
                .Unwind("organizations")
                .Match(new BsonDocument
                {
                    {
                        "$and",
                        new BsonArray(match.Select(x => new BsonDocument(x.Key, x.Value)))
                    }
                })
                .Project(new BsonDocument("_id", 1));

            var documents = await query.ToListAsync();
            return documents.Select(x => x["_id"].AsGuid).ToList();
        }
    }
}