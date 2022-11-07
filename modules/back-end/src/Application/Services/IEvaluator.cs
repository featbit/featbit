using Domain.EndUsers;
using Domain.FeatureFlags;

namespace Application.Services;

public interface IEvaluator
{
    Task<UserVariation> EvaluateAsync(FeatureFlag flag, EndUser user);
}