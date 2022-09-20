using Api.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Api.Filters;

public class ApiActionFilter : ActionFilterAttribute
{
    public override void OnActionExecuted(ActionExecutedContext context)
    {
        var hasUnHandledException = context.Exception != null && !context.ExceptionHandled; 
        if (context.Canceled || hasUnHandledException)
        {
            base.OnActionExecuted(context);
            return;
        }

        if (context.Result is ObjectResult { Value: not ApiResponse } objectResult)
        {
            var apiResponse = ApiResponse.Ok(objectResult.Value);
            context.Result = new JsonResult(apiResponse);
        }
    }
}