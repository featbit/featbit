using Domain.Resources;
using Domain.Segments;
using Domain.Targeting;

namespace Domain.UnitTests.Segments;

public class SegmentTests
{
	[Fact]
	public void EnvSpecificSegmentIsApplicableWhenEnvIdMatches()
	{
		var envId = Guid.NewGuid();
		var segment = CreateSegment(SegmentType.EnvironmentSpecific, envId, []);

		var isApplicable = segment.IsApplicableToEnv(envId, RN.ForEnv("project-a", "dev"));

		Assert.True(isApplicable);
	}

	[Fact]
	public void EnvSpecificSegmentIsNotApplicableWhenEnvIdDoesNotMatch()
	{
		var segmentEnvId = Guid.NewGuid();
		var anotherEnvId = Guid.NewGuid();
		var segment = CreateSegment(SegmentType.EnvironmentSpecific, segmentEnvId, []);

		var isApplicable = segment.IsApplicableToEnv(anotherEnvId, RN.ForEnv("project-a", "dev"));

		Assert.False(isApplicable);
	}

	[Fact]
	public void SharedSegmentIsApplicableWhenAnyScopeContainsEnvRn()
	{
		var segment = CreateSegment(
			SegmentType.Shared,
			Guid.NewGuid(),
			[
				RN.ForProject("project-a"),
				RN.ForProject("project-b")
			]
		);

		var isApplicable = segment.IsApplicableToEnv(Guid.NewGuid(), RN.ForEnv("project-a", "prod"));

		Assert.True(isApplicable);
	}

	[Fact]
	public void SharedSegmentIsNotApplicableWhenNoScopeMatchesEnvRn()
	{
		var segment = CreateSegment(
			SegmentType.Shared,
			Guid.NewGuid(),
			[RN.ForProject("project-b")]
		);

		var isApplicable = segment.IsApplicableToEnv(Guid.NewGuid(), RN.ForEnv("project-a", "prod"));

		Assert.False(isApplicable);
	}

	private static Segment CreateSegment(string type, Guid envId, string[] scopes)
	{
		return new Segment(
			workspaceId: Guid.NewGuid(),
			envId: envId,
			name: "test-segment",
			key: "test-segment",
			type: type,
			scopes: scopes,
			included: [],
			excluded: [],
			rules: Array.Empty<MatchRule>(),
			description: string.Empty
		);
	}
}
