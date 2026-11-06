using Api.Filters;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Application.IntegrationTests.Stubs;

public class TestResourceOrganizationFilter() : ResourceOrganizationFilter(null!, null!)
{
    public override async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next) =>
        await next();
}
