using Application.Bases.Models;
using Application.Segments;
using Domain.Resources;
using Domain.Segments;

namespace Infrastructure.AppService;

public class EnvironmentAppService(IResourceServiceV2 resourceService, ISegmentService segmentService)
    : IEnvironmentAppService
{
    public async Task<PagedResult<Segment>> GetPagedSegmentsAsync(GetSegmentList request)
    {
        var rn = await resourceService.GetRNAsync(request.EnvId, ResourceTypes.Env);

        var segments = await segmentService.GetListAsync(request.WorkspaceId, rn, request.Filter);
        foreach (var segment in segments.Items)
        {
            segment.EnvId = request.EnvId;
        }

        return segments;
    }

    public async Task<ICollection<Segment>> GetSegmentsAsync(Guid workspaceId, Guid envId)
    {
        var rn = await resourceService.GetRNAsync(envId, ResourceTypes.Env);

        var segments = await segmentService.GetListAsync(workspaceId, rn);
        foreach (var segment in segments)
        {
            segment.EnvId = envId;
        }

        return segments;
    }
}