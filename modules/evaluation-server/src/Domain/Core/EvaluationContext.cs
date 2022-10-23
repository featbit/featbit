using System.Text.Json;
using Domain.EndUsers;

namespace Domain.Core;

public class EvaluationContext
{
    public JsonElement Flag { get; }

    public EndUser User { get; }

    public EvaluationContext(JsonElement flag, EndUser user)
    {
        Flag = flag;
        User = user;
    }
}