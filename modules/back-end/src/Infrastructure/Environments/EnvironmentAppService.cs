using Application.Bases.Models;
using Application.Segments;
using Domain.Resources;
using Domain.Segments;

namespace Infrastructure.Environments;

public class EnvironmentAppService : IEnvironmentAppService
{
    private readonly IResourceServiceV2 _resourceService;
    private readonly ISegmentService _segmentService;

    public EnvironmentAppService(IResourceServiceV2 resourceService, ISegmentService segmentService)
    {
        _resourceService = resourceService;
        _segmentService = segmentService;
    }


    public async Task<PagedResult<Segment>> GetPagedSegmentsAsync(GetSegmentList request)
    {
        var rn = await _resourceService.GetRNAsync(request.EnvId, ResourceTypes.Env);
        var segments = await _segmentService.GetListAsync(request.WorkspaceId, rn, request.Filter);

        return segments;
    }

    public async Task<ICollection<Segment>> GetSegmentsAsync(Guid workspaceId, Guid envId)
    {
        var rn = await _resourceService.GetRNAsync(envId, ResourceTypes.Env);
        var segments = await _segmentService.GetListAsync(workspaceId, rn);

        return segments;
    }
}