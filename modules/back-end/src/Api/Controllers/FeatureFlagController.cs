using Newtonsoft.Json;
using System.Text.Json;
using Api.Authentication;
using Api.Authorization;
using Api.Swagger.Examples;
using Application.Bases.Models;
using Application.FeatureFlags;
using Domain.FeatureFlags;
using Domain.SemanticPatch;
using Domain.Targeting;
using Domain.Utils;
using Microsoft.AspNetCore.JsonPatch;
using Microsoft.AspNetCore.JsonPatch.Operations;
using Swashbuckle.AspNetCore.Filters;

namespace Api.Controllers;

[Authorize(Permissions.ManageFeatureFlag)]
[Route("api/v{version:apiVersion}/envs/{envId:guid}/feature-flags")]
public class FeatureFlagController : ApiControllerBase
{
    /// <summary>
    /// Get flag list of an environment
    /// </summary>
    /// <remarks>
    /// Get the list of flags of a particular environment.
    /// </remarks>
    [OpenApi]
    [HttpGet]
    public async Task<ApiResponse<PagedResult<FeatureFlagVm>>> GetListAsync(
        Guid envId,
        [FromQuery] FeatureFlagFilter filter)
    {
        var request = new GetFeatureFlagList
        {
            EnvId = envId,
            Filter = filter
        };

        var flags = await Mediator.Send(request);
        return Ok(flags);
    }

    /// <summary>
    /// Get the list of pending changes of a flag
    /// </summary>
    /// <remarks>
    /// Get the list of pending changes of a particular flag
    /// </remarks>
    [HttpGet("{key}/pending-changes")]
    public async Task<ApiResponse<ICollection<PendingChangesVm>>> GetPendingChangesAsync(Guid envId, string key)
    {
        var request = new GetPendingChangesList
        {
            EnvId = envId,
            Key = key
        };

        var pendingChangesList = await Mediator.Send(request);
        return Ok(pendingChangesList);
    }
    
    /// <summary>
    /// Get a feature flag
    /// </summary>
    /// <remarks>
    /// Get a single feature flag by key.
    /// </remarks>
    [OpenApi]
    [HttpGet("getinstructions")]
    public async Task<ApiResponse<IEnumerable<FlagInstruction>>> GetInsAsync(Guid envId)
    {
        var request = new GetFeatureFlag
        {
            EnvId = envId,
            Key = "gg"
        };
        
        var flag = await Mediator.Send(request);
        var flag2 = await Mediator.Send(request);
         flag2.IsEnabled = true;
         flag2.IsArchived = true;
         flag2.Name = "";
         flag2.Description = "abc description";
        
         flag2.Tags = new List<string> { "123", "456" };
        
         flag2.VariationType = "string";
        //flag2.Variations.Remove(flag2.Variations.First());
          var variationToUpdate = flag2.Variations.Last();
          variationToUpdate.Name = "Updated";
          variationToUpdate.Value = "false";
          flag2.Variations.Add(new Variation
          {
              Name = "aaaaa",
              Value = "true"
          });
        
         flag2.DisabledVariationId = flag2.Variations.First().Id;

         flag2.Fallthrough.DispatchKey = "ddd";
         // flag2.Fallthrough = new Fallthrough
         // {
         //     DispatchKey = "newkey",
         //     Variations = new List<RolloutVariation>{ new RolloutVariation { Id = flag2.Variations.ElementAt(1).Id, Rollout = new double[] { 0, 1 }} }
         // };
        
         var targetUsers1 = flag2.TargetUsers.First();
         targetUsers1.KeyIds = new List<string> { "user3", "user2" };
         var targetUsers2 = flag2.TargetUsers.Last();
         targetUsers2.KeyIds = new List<string> ();

        flag2.Rules = new List<TargetRule>();
        flag2.Rules.Add(new TargetRule
        {
            Id = "87b3ce72-f871-4291-a87d-ee0494ebe855",
            Name = "rule1233",
            DispatchKey = "rule1",
            IncludedInExpt = true,
            Conditions = new List<Condition>
            {
                new Condition
                {
                    Id = "0.0125179",
                    Property = "name",
                    Op = "IsOneOf",
                    Value = System.Text.Json.JsonSerializer.Serialize(new List<string> { "ooo", "user1", "user2" }, ReusableJsonSerializerOptions.Web)
                },
                new Condition
                {
                    Id = "xxxxxxy",
                    Property = "name",
                    Op = "Equal",
                    Value = "abc"
                },
                new Condition
                {
                    Id = "0.646952",
                    Property = "keyId",
                    Op = "IsFalse",
                    Value = "IsFalse"
                }
            },
            Variations = new List<RolloutVariation>
            {
                new RolloutVariation
                {
                    Id = "variation1",
                    Rollout = new double[] { 0, 0.5 }
                },
                new RolloutVariation
                {
                    Id = "variation1",
                    Rollout = new double[] { 0.5, 1 }
                }
            }
        });
        flag2.Rules.Add(new TargetRule
        {
            Id = "7dd0b0ab-5b13-4948-9cff-fad39b2272d7",
            Name = "rule1233",
            DispatchKey = "rule1",
            IncludedInExpt = true,
            Conditions = new List<Condition>
            {
                new Condition
                {
                    Id = "0.378575",
                    Property = "keyId",
                    Op = "IsOneOf",
                    Value = System.Text.Json.JsonSerializer.Serialize(new List<string> { "user1", "user2" }, ReusableJsonSerializerOptions.Web)
                },
                new Condition
                {
                    Id = "xxxxxx",
                    Property = "name",
                    Op = "Equal",
                    Value = "abc"
                }
            },
            Variations = new List<RolloutVariation>
            {
                new RolloutVariation
                {
                    Id = "variation1",
                    Rollout = new double[] { 0, 0.5 }
                },
                new RolloutVariation
                {
                    Id = "variation1",
                    Rollout = new double[] { 0.5, 1 }
                }
            }
        });
        
        var result = FlagComparer.Compare(flag, flag2);
        return Ok(result);
    }
    
    /// <summary>
    /// Archive a feature flag
    /// </summary>
    [OpenApi]
    [HttpPut("apply-patches")]
    public async Task<ApiResponse<FeatureFlag>> ApplyAsync(Guid envId, JsonElement json)
    {
        var request = new GetFeatureFlag
        {
            EnvId = envId,
            Key = "gg"
        };

        var flag = await Mediator.Send(request);

        var instructions = new FlagInstructions(json);
        flag.ApplyInstructions(instructions, CurrentUser.Id);
        
        return Ok(flag);
    }
    
    /// <summary>
    /// Get a feature flag
    /// </summary>
    /// <remarks>
    /// Get a single feature flag by key.
    /// </remarks>
    [OpenApi]
    [HttpGet("{key}")]
    public async Task<ApiResponse<FeatureFlag>> GetAsync(Guid envId, string key)
    {
        var request = new GetFeatureFlag
        {
            EnvId = envId,
            Key = key
        };

        var flag = await Mediator.Send(request);
        return Ok(flag);
    }

    [HttpGet("is-key-used")]
    public async Task<ApiResponse<bool>> IsKeyUsedAsync(Guid envId, string key)
    {
        var request = new IsFeatureFlagKeyUsed
        {
            EnvId = envId,
            Key = key
        };

        var isUsed = await Mediator.Send(request);
        return Ok(isUsed);
    }

    /// <summary>
    /// Create a feature flag
    /// </summary>
    /// <remarks>
    /// Create a feature flag with the given name, key, and description.
    /// </remarks>
    [OpenApi]
    [HttpPost]
    public async Task<ApiResponse<FeatureFlag>> CreateAsync(Guid envId, CreateFeatureFlag request)
    {
        request.EnvId = envId;

        var flag = await Mediator.Send(request);
        return Ok(flag);
    }

    /// <summary>
    /// Archive a feature flag
    /// </summary>
    [OpenApi]
    [HttpPut("{key}/archive")]
    public async Task<ApiResponse<bool>> ArchiveAsync(Guid envId, string key)
    {
        var request = new ArchiveFeatureFlag
        {
            EnvId = envId,
            Key = key
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Restore a feature flag
    /// </summary>
    [OpenApi]
    [HttpPut("{key}/restore")]
    public async Task<ApiResponse<bool>> RestoreAsync(Guid envId, string key)
    {
        var request = new RestoreFeatureFlag
        {
            EnvId = envId,
            Key = key
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Delete a feature flag
    /// </summary>
    [OpenApi]
    [HttpDelete("{key}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid envId, string key)
    {
        var request = new DeleteFeatureFlag
        {
            EnvId = envId,
            Key = key
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPut("{key}/toggle")]
    public async Task<ApiResponse<bool>> ToggleAsync(Guid envId, string key)
    {
        var request = new ToggleFeatureFlag
        {
            EnvId = envId,
            Key = key
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPut("{key}/settings")]
    public async Task<ApiResponse<bool>> UpdateSettingAsync(Guid envId, string key, UpdateSetting request)
    {
        request.Key = key;
        request.EnvId = envId;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Update a feature flag with the JSON patch method
    /// </summary>
    /// <remarks>
    /// Perform a partial update to a feature flag. The request body must be a valid JSON patch.
    /// </remarks>
    [OpenApi]
    [SwaggerRequestExample(typeof(Operation), typeof(PatchFeatureFlagExamples))]
    [HttpPatch("{key}")]
    public async Task<ApiResponse<bool>> PatchAsync(Guid envId, string key, [FromBody] JsonElement jsonElement)
    {
        var patch = JsonConvert.DeserializeObject<JsonPatchDocument>(jsonElement.GetRawText());
        var request = new PatchFeatureFlag
        {
            EnvId = envId,
            Key = key,
            Patch = patch
        };

        var result = await Mediator.Send(request);
        return result.Success ? Ok(true) : Error<bool>(result.Message);
    }

    [HttpPut("{key}/variations")]
    public async Task<ApiResponse<bool>> UpdateVariationsAsync(Guid envId, string key, UpdateVariations request)
    {
        request.Key = key;
        request.EnvId = envId;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPut("{key}/targeting")]
    public async Task<ApiResponse<bool>> UpdateTargetingAsync(Guid envId, string key, UpdateTargeting request)
    {
        request.Key = key;
        request.EnvId = envId;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPost("copy-to-env/{targetEnvId:guid}")]
    public async Task<ApiResponse<CopyToEnvResult>> CopyToEnvAsync(
        Guid targetEnvId,
        [FromBody] ICollection<Guid> flagIds)
    {
        var request = new CopyToEnv
        {
            TargetEnvId = targetEnvId,
            FlagIds = flagIds
        };

        var copyToEnvResult = await Mediator.Send(request);
        return Ok(copyToEnvResult);
    }

    [HttpGet("all-tags")]
    public async Task<ApiResponse<ICollection<string>>> GetAllTagsAsync(Guid envId)
    {
        var request = new GetAllTag
        {
            EnvId = envId
        };

        var tags = await Mediator.Send(request);
        return Ok(tags);
    }

    [HttpPut("{key}/tags")]
    public async Task<ApiResponse<bool>> SetTagsAsync(Guid envId, string key, ICollection<string> tags)
    {
        var request = new SetTags
        {
            EnvId = envId,
            Key = key,
            Tags = tags
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpGet]
    [Route("insights")]
    public async Task<ApiResponse<IEnumerable<InsightsVm>>> GetStatsByVariationAsync(
        Guid envId,
        [FromQuery] StatsByVariationFilter filter)
    {
        var request = new GetInsights
        {
            EnvId = envId,
            Filter = filter
        };

        var stats = await Mediator.Send(request);
        return Ok(stats);
    }
}