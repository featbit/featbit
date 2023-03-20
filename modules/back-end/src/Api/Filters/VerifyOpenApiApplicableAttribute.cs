using Api.Authentication;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Api.Filters;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class VerifyOpenApiApplicableAttribute : Attribute, IResourceFilter
{
    public void OnResourceExecuting(ResourceExecutingContext context)
    {
        if (context.HttpContext.User.Identity?.AuthenticationType == Schemes.OpenApi)
        {
            if (context.ActionDescriptor is not ControllerActionDescriptor descriptor)
            {
                return;
            }

            var controllerAuthorizeData =
                descriptor.ControllerTypeInfo.GetCustomAttributes(true).OfType<IAuthorizeData>();
            var actionAuthorizeData =
                descriptor.MethodInfo.GetCustomAttributes(true).OfType<IAuthorizeData>();

            if (
                controllerAuthorizeData.All(x => string.IsNullOrWhiteSpace(x.Policy)) &&
                actionAuthorizeData.All(x => string.IsNullOrWhiteSpace(x.Policy))
            )
            {
                context.Result = new ForbidResult();
            }
        }
    }

    public void OnResourceExecuted(ResourceExecutedContext context)
    {
    }
}