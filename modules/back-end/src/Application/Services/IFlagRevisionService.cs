using Domain.FeatureFlags;
using Domain.FlagRevisions;

namespace Application.Services;

public interface IFlagRevisionService : IService<FlagRevision>
{
    Task<FlagRevision> CreateForFlag(FeatureFlag flag, string comment, Guid currentUserId);
}