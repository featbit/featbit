using Newtonsoft.Json;
using System.Text.Json;
using Api.Authentication;
using Api.Authorization;
using Application.Bases.Models;
using Application.FeatureFlags;
using Domain.FeatureFlags;
using Microsoft.AspNetCore.JsonPatch;

namespace Api.Controllers;

[Authorize(Permissions.ManageFeatureFlag)]
[Route("api/v{version:apiVersion}/envs/{envId:guid}/feature-flags")]
public class FeatureFlagController : ApiControllerBase
{
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

    [HttpPost]
    public async Task<ApiResponse<FeatureFlag>> CreateAsync(Guid envId, CreateFeatureFlag request)
    {
        request.EnvId = envId;

        var flag = await Mediator.Send(request);
        return Ok(flag);
    }

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
    /// Update a feature with the JSON patch method
    /// </summary>
    /// <remarks>
    /// This is a http PATCH method to update a feature flag. Sample requests:
    ///
    ///     Update the name and description
    ///     PATCH api/v1/envs/{{envId}}/feature-flags/{{flagKey}}
    ///     [
    ///      {
    ///        "op": "replace",
    ///        "path": "/name",
    ///        "value": "name 1"
    ///      },
    ///      {
    ///        "op": "replace",
    ///        "path": "/description",
    ///        "value": "description 1"
    ///      }
    ///     ]
    ///
    ///     Archive the flag
    ///     PATCH api/v1/envs/{{envId}}/feature-flags/{{flagKey}}
    ///     [
    ///      {
    ///        "op": "replace",
    ///        "path": "/isArchived",
    ///        "value": true
    ///      }
    ///     ]
    ///
    ///     Restore the flag
    ///     PATCH api/v1/envs/{{envId}}/feature-flags/{{flagKey}}
    ///     [
    ///      {
    ///        "op": "replace",
    ///        "path": "/isArchived",
    ///        "value": false
    ///      }
    ///     ]
    ///
    ///     Enable the flag
    ///     PATCH api/v1/envs/{{envId}}/feature-flags/{{flagKey}}
    ///     [
    ///      {
    ///        "op": "replace",
    ///        "path": "/isEnabled",
    ///        "value": true
    ///      }
    ///     ]
    ///
    ///     Disable the flag
    ///     PATCH api/v1/envs/{{envId}}/feature-flags/{{flagKey}}
    ///     [
    ///      {
    ///        "op": "replace",
    ///        "path": "/isEnabled",
    ///        "value": false
    ///      }
    ///     ]
    ///
    ///     Add a tag to the end
    ///     PATCH api/v1/envs/{{envId}}/feature-flags/{{flagKey}}
    ///     [
    ///      {
    ///        "op": "add",
    ///        "path": "/tags/-",
    ///        "value": "tag1"
    ///      }
    ///     ]
    ///
    ///     Remove the first tag
    ///     PATCH api/v1/envs/{{envId}}/feature-flags/{{flagKey}}
    ///     [
    ///      {
    ///        "op": "add",
    ///        "path": "/tags/0"
    ///      }
    ///     ]
    ///
    ///     Add target user when the targeting variation has no users: make sure that variation id and user keyId exist
    ///     PATCH api/v1/envs/{{envId}}/feature-flags/{{flagKey}}
    ///     [
    ///      {
    ///        "op": "add",
    ///        "path":  "/targetUsers/-",
    ///        "value": {
    ///          "variationId": "51dfeca4-c1b0-4aa4-aff1-851ddb1c180d",
    ///          "keyIds": ["user1", "user2"]
    ///        }
    ///      }
    ///     ]
    ///
    ///     Add target user to the frist variation
    ///     PATCH api/v1/envs/{{envId}}/feature-flags/{{flagKey}}
    ///     [
    ///      {
    ///        "op": "add",
    ///        "path":  "/targetUsers/0/keyIds/0",
    ///        "value": "user4"
    ///      }
    ///     ]
    ///
    ///     Remove the first rule
    ///     PATCH api/v1/envs/{{envId}}/feature-flags/{{flagKey}}
    ///     [
    ///      {
    ///        "op": "remove",
    ///        "path": "/rules/0"
    ///      }
    ///     ]
    ///
    ///     Remove the first rule
    ///     PATCH api/v1/envs/{{envId}}/feature-flags/{{flagKey}}
    ///     [
    ///      {
    ///        "op": "remove",
    ///        "path": "/rules/0",
    ///        "value": {
    ///          "id": "f5a5629e-523d-459e-b0b0-f4996e32842a",
    ///          "name": "Rule 2",
    ///          "dispatchKey": "name",
    ///          "includedInExpt": false,
    ///          "conditions": [{
    ///            "property": "keyId",
    ///            "op": "IsOneOf",
    ///            "value": "[\"ja\",\"jb\",\"jc\"]"
    ///          }],
    ///         "variations": [{
    ///           "id": "51dfeca4-c1b0-4aa4-aff1-851ddb1c180d",
    ///           "rollout": [0,0.64],
    ///           "exptRollout": 1
    ///         },
    ///         {
    ///          "id": "990c319a-a21d-418b-a900-4fd4713ade29",
    ///          "rollout": [0.64,1],
    ///          "exptRollout": 1
    ///         }]
    ///        }
    ///      }
    ///     ]
    /// 
    /// </remarks>
    [OpenApi]
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