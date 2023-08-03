// namespace Domain.SemanticPatch;
//
// public class SemanticPatchFactory
// {
//     public static ISemanticPatch Create(string semanticPatchType)
//     {
//         return semanticPatchType switch
//         {
//             SemanticPatchType.FeatureFlag => new FeatureFlagSemanticPatch(),
//             _ => throw new ArgumentException($"Unknown semantic patch type: {semanticPatchType}", nameof(semanticPatchType))
//         };
//     }
// }