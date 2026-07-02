using System.Net.Mime;
using Api.Authorization;
using Api.Filters;
using Application.Users;
using Domain.Policies;
using Swashbuckle.AspNetCore.Annotations;

namespace Api.Controllers;

[Authorize]
[ApiController]
[VerifyOpenApiApplicable]
[Produces(MediaTypeNames.Application.Json)]
[SwaggerResponse(200)]
[SwaggerResponse(401)]
[SwaggerResponse(403)]
[Route("api/v{version:apiVersion}/[controller]")]
public class ApiControllerBase : ControllerBase
{
    private ISender? _mediator;
    protected ISender Mediator
    {
        get { return _mediator ??= HttpContext.RequestServices.GetRequiredService<ISender>(); }
    }

    private ICurrentUser? _currentUser;
    protected ICurrentUser CurrentUser
    {
        get { return _currentUser ??= HttpContext.RequestServices.GetRequiredService<ICurrentUser>(); }
    }

    private Guid? _orgId;
    protected Guid OrgId
    {
        get
        {
            if (_orgId.HasValue)
            {
                return _orgId.Value;
            }

            _orgId = HttpContext.Request.OrganizationId();
            return _orgId.Value;
        }
    }

    private Guid? _workspaceId;
    protected Guid WorkspaceId
    {
        get
        {
            if (_workspaceId.HasValue)
            {
                return _workspaceId.Value;
            }

            _workspaceId = HttpContext.Request.WorkspaceId();
            return _workspaceId.Value;
        }
    }

    protected Task<PolicyStatement[]> GetRequestPermissionsAsync()
    {
        var requestPermissions = HttpContext.RequestServices.GetRequiredService<IRequestPermissions>();

        return requestPermissions.GetAsync(HttpContext);
    }

    protected static ApiResponse<TData> Ok<TData>(TData data) => ApiResponse<TData>.Ok(data);

    protected static ApiResponse<TData> Error<TData>(string errorCode) => ApiResponse<TData>.Error(errorCode);
}