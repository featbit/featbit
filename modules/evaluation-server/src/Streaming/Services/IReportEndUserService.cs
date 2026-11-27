using Domain.EndUsers;

namespace Streaming.Services;

public interface IReportEndUserService
{
    Task ReportEndUserAndMauAsync(Guid envId, EndUser user);
}