using System.Reflection;
using Api.Authentication;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Api.Filters;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class VerifyOpenApiApplicableAttribute : Attribute, IResourceFilter
{
    // This method is called before the controller action is executed
    public void OnResourceExecuting(ResourceExecutingContext context)
    {
        // Check if the user is authenticated with OpenApi scheme
        if (context.HttpContext.User.Identity?.AuthenticationType != Schemes.OpenApi)
        {
            return;
        }

        if (context.ActionDescriptor is not ControllerActionDescriptor descriptor)
        {
            return;
        }

        // Check if the action has OpenApi attribute
        var actionOpenApiAttribute = descriptor.MethodInfo.GetCustomAttribute<OpenApiAttribute>(true);
        if (actionOpenApiAttribute != null)
        {
            return;
        }

        // Check if the controller has OpenApi attribute
        var controllerOpenApiAttribute = descriptor.ControllerTypeInfo.GetCustomAttribute<OpenApiAttribute>(true);
        if (controllerOpenApiAttribute != null)
        {
            return;
        }

        // If neither the action nor the controller has OpenApi attribute, forbid access
        context.Result = new ForbidResult();
    }

    // This method is called after the controller action is executed
    public void OnResourceExecuted(ResourceExecutedContext context)
    {
    }
}