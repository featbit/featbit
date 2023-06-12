namespace Domain.Evaluation;

public interface IEvaluator
{
    ValueTask<UserVariation> EvaluateAsync(EvaluationScope scope);
}