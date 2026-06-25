using Application.Bases;
using Application.Bases.Exceptions;
using Application.Policies;
using Application.Services;
using AutoMapper;
using Domain.Policies;

namespace Application.UnitTests.Handlers;

public class UpdatePolicySettingHandlerTests
{
    private static IMapper NoOpMapper()
    {
        var mock = new Mock<IMapper>();
        mock.Setup(x => x.Map<PolicyVm>(It.IsAny<object>())).Returns(new PolicyVm());
        return mock.Object;
    }

    [Fact]
    public async Task Handle_SysManagedPolicy_ThrowsBusinessException()
    {
        var sysManaged = new Policy(Guid.NewGuid(), "n", "k", "d") { Type = PolicyTypes.SysManaged };
        var service = new Mock<IPolicyService>();
        service.Setup(x => x.GetAsync(It.IsAny<Guid>())).ReturnsAsync(sysManaged);
        var sut = new UpdatePolicySettingHandler(service.Object, NoOpMapper());

        var ex = await Assert.ThrowsAsync<BusinessException>(
            () => sut.Handle(new UpdatePolicySetting { PolicyId = sysManaged.Id, Name = "x" }, CancellationToken.None));

        Assert.Equal(ErrorCodes.CannotModifySysManagedPolicy, ex.Message);
        service.Verify(x => x.UpdateAsync(It.IsAny<Policy>()), Times.Never);
    }

    [Fact]
    public async Task Handle_CustomerManaged_UpdatesPolicy()
    {
        var policy = new Policy(Guid.NewGuid(), "n", "k", "d");
        var service = new Mock<IPolicyService>();
        service.Setup(x => x.GetAsync(It.IsAny<Guid>())).ReturnsAsync(policy);
        var sut = new UpdatePolicySettingHandler(service.Object, NoOpMapper());

        var result = await sut.Handle(
            new UpdatePolicySetting { PolicyId = policy.Id, Name = "new-name", Description = "new-desc" },
            CancellationToken.None);

        Assert.Equal("new-name", policy.Name);
        Assert.Equal("new-desc", policy.Description);
        service.Verify(x => x.UpdateAsync(policy), Times.Once);
        Assert.NotNull(result);
    }
}
