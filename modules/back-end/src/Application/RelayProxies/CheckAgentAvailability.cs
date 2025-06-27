using System.Net;

namespace Application.RelayProxies;

public class CheckAgentAvailability : RpAgentBase, IRequest<HttpStatusCode>;

public class CheckAgentAvailabilityValidator : AbstractValidator<CheckAgentAvailability>
{
    public CheckAgentAvailabilityValidator()
    {
        Include(new RpAgentBaseValidator());
    }
}

public class CheckAgentAvailabilityHandler(IAgentService service)
    : IRequestHandler<CheckAgentAvailability, HttpStatusCode>
{
    public async Task<HttpStatusCode> Handle(CheckAgentAvailability request, CancellationToken cancellationToken)
        => await service.CheckAvailabilityAsync(request.Host);
}