using Application.Resources;
using Domain.Resources;

namespace Application.Services;

public interface IResourceServiceV2
{
    Task<IEnumerable<ResourceV2>> GetResourcesAsync(Guid spaceId, ResourceFilterV2 filter);
}