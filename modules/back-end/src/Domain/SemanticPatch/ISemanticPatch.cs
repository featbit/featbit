namespace Domain.SemanticPatch;

public interface ISemanticPatch
{
    void GetPatches<T>(T entity1, T entity2);
    void ApplyPatches();
}