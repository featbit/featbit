using System.Linq.Expressions;
using System.Net;
using Api;
using Application.Services;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.FlagChangeRequests;
using Domain.FlagDrafts;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace Application.IntegrationTests.Controllers;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class ChangeRequestPreviewControllerTests(TestApp app)
{
    [Fact]
    public async Task GetPreview_ReviewedDisabledVariationDeleted_Returns409WithoutMutatingFlag()
    {
        var organization = Guid.NewGuid();
        var flag = new FeatureFlag(Guid.NewGuid(), "Flag", "", "flag", true, VariationTypes.String,
            new List<Variation>
            {
                new() { Id = "on", Name = "On", Value = "on" },
                new() { Id = "off", Name = "Off", Value = "off" }
            }, "on", "on", [], Guid.NewGuid()) { Id = Guid.NewGuid() };
        var next = flag.Clone();
        next.DisabledVariationId = "off";
        var draft = new FlagDraft(flag.EnvId, flag.Id, new DataChange(flag).To(next), Guid.NewGuid()) { Id = Guid.NewGuid() };
        var change = new FlagChangeRequest(organization, flag.EnvId, draft.Id, flag.Id, [Guid.NewGuid()], Guid.NewGuid())
            { Id = Guid.NewGuid() };
        flag.Variations = flag.Variations.Where(x => x.Id != "off").ToList();
        var revision = flag.Revision;
        var flags = new Mock<IFeatureFlagService>();
        flags.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>())).ReturnsAsync(flag);
        var drafts = new Mock<IFlagDraftService>();
        drafts.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FlagDraft, bool>>>())).ReturnsAsync(draft);
        var changes = new Mock<IFlagChangeRequestService>();
        changes.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FlagChangeRequest, bool>>>())).ReturnsAsync(change);
        var licenses = new Mock<ILicenseService>();
        licenses.Setup(x => x.IsFeatureGrantedAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(true);
        using var factory = app.WithServices(services =>
        {
            services.Replace(ServiceDescriptor.Singleton(flags.Object));
            services.Replace(ServiceDescriptor.Singleton(drafts.Object));
            services.Replace(ServiceDescriptor.Singleton(changes.Object));
            services.Replace(ServiceDescriptor.Singleton(licenses.Object));
        });
        using var client = await app.CreateAuthenticatedClientAsync(factory);
        client.DefaultRequestHeaders.Add(ApiConstants.OrgIdHeaderKey, organization.ToString());
        client.DefaultRequestHeaders.Add(ApiConstants.WorkspaceHeaderKey, Guid.NewGuid().ToString());

        using var response = await client.GetAsync($"/api/v1/envs/{flag.EnvId}/change-requests/{change.Id}/preview");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(revision, flag.Revision);
        Assert.Equal("on", flag.DisabledVariationId);
        Assert.False(draft.IsApplied());
        flags.Verify(x => x.UpdateAsync(It.IsAny<FeatureFlag>()), Times.Never);
    }
}
