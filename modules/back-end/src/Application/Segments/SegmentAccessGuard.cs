using Application.Bases.Exceptions;

namespace Application.Segments;

public class SegmentAccessGuard(IResourceService resources)
{
    public async Task EnsureAccessibleAsync(Guid organizationId, Guid environmentId, Guid segmentId)
    {
        var resource = await resources.GetSegmentRnAsync(environmentId, segmentId);
        if (organizationId == Guid.Empty || resource == null || resource.OrganizationId != organizationId ||
            string.IsNullOrWhiteSpace(resource.Rn))
        {
            throw new ForbiddenException();
        }
    }
}
