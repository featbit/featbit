using Application.AuditLogs;
using Application.Bases.Models;
using Application.Users;
using Domain.AuditLogs;
using Domain.Users;

namespace Application.FeatureFlags;

public class GetFeatureFlagList : IRequest<PagedResult<FeatureFlagVm>>
{
    public Guid EnvId { get; set; }

    public FeatureFlagFilter Filter { get; set; }
}

public class GetFeatureFlagListHandler(
    IFeatureFlagService flagService,
    IUserService userService,
    IAuditLogService auditLogService,
    IMapper mapper)
    : IRequestHandler<GetFeatureFlagList, PagedResult<FeatureFlagVm>>
{
    public async Task<PagedResult<FeatureFlagVm>> Handle(GetFeatureFlagList request, CancellationToken cancellationToken)
    {
        var flags = await flagService.GetListAsync(request.EnvId, request.Filter);

        var flagIds = flags.Items.Select(x => x.Id.ToString()).ToArray();
        var lastChanges = await auditLogService.GetLastChangesAsync(
            request.EnvId,
            AuditLogRefTypes.FeatureFlag,
            flagIds
        );

        var users = await GetUsersAsync();

        var flagVms = mapper.Map<PagedResult<FeatureFlagVm>>(flags);
        foreach (var flag in flags.Items)
        {
            var vm = flagVms.Items.First(x => x.Id == flag.Id);

            var creator = users.FirstOrDefault(x => x.Id == flag.CreatorId);
            if (creator != null)
            {
                vm.Creator = mapper.Map<UserVm>(creator);
            }

            var lastChange = lastChanges.FirstOrDefault(x => x.RefId == flag.Id.ToString());
            if (lastChange != null)
            {
                var updator = users.FirstOrDefault(x => x.Id == lastChange.OperatorId);
                vm.LastChange = new LastChangeVm(lastChange, updator);
            }
        }

        return flagVms;

        async Task<ICollection<User>> GetUsersAsync()
        {
            var creatorIds = flags.Items.Select(x => x.CreatorId);
            var updatorIds = lastChanges.Select(x => x.OperatorId);

            var userIds = creatorIds.Concat(updatorIds).Distinct();

            return await userService.GetListAsync(userIds);
        }
    }
}