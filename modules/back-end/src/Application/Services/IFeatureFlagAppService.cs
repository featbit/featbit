namespace Application.Services;

public interface IFeatureFlagAppService
{
    Task ApplyDraftAsync(Guid draftId, string operation, Guid operatorId);
}