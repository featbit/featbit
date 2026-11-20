using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.Users;

namespace Application.Members;

public class GetMemberLookupList : IRequest<PagedResult<MemberLookupVm>>
{
    public Guid OrganizationId { get; set; }

    public MemberFilter Filter { get; set; }
}

public class GetMemberLookupListHandler(
    IMemberService service,
    IOrganizationService organizationService,
    ICurrentUser currentUser)
    : IRequestHandler<GetMemberLookupList, PagedResult<MemberLookupVm>>
{
    public async ValueTask<PagedResult<MemberLookupVm>> Handle(
        GetMemberLookupList request,
        CancellationToken cancellationToken)
    {
        var isOrganizationMember = await organizationService.ContainsUserAsync(request.OrganizationId, currentUser.Id);
        if (!isOrganizationMember)
        {
            throw new ForbiddenException();
        }

        var members = await service.GetLookupListAsync(request.OrganizationId, request.Filter);
        return MemberMapper.ToLookupVm(members);
    }
}
