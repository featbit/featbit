using System.Text.Json;
using Domain.EndUsers;

namespace Domain.Evaluation;

public interface IRuleMatcher
{
    ValueTask<bool> IsMatchAsync(JsonElement rule, EndUser user);
}