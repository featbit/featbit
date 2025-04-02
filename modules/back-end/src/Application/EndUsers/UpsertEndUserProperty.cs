using Application.Bases;
using Domain.EndUsers;

namespace Application.EndUsers;

public class UpsertEndUserProperty : IRequest<EndUserProperty>
{
    public Guid EnvId { get; set; }

    public Guid PropertyId { get; set; }

    public string Name { get; set; }

    public ICollection<EndUserPresetValue> PresetValues { get; set; }

    public bool UsePresetValuesOnly { get; set; }

    public bool IsDigestField { get; set; }

    public string Remark { get; set; }

    public EndUserProperty AsProperty()
    {
        var property = new EndUserProperty(
            EnvId, Name, PresetValues, UsePresetValuesOnly, isDigestField: IsDigestField, remark: Remark
        )
        {
            Id = PropertyId
        };

        return property;
    }
}

public class UpsertEndUserPropertyValidator : AbstractValidator<UpsertEndUserProperty>
{
    public UpsertEndUserPropertyValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));
    }
}

public class UpsertEndUserPropertyHandler : IRequestHandler<UpsertEndUserProperty, EndUserProperty>
{
    private readonly IEndUserService _service;

    public UpsertEndUserPropertyHandler(IEndUserService service)
    {
        _service = service;
    }

    public async Task<EndUserProperty> Handle(UpsertEndUserProperty request, CancellationToken cancellationToken)
    {
        return await _service.UpsertPropertyAsync(request.AsProperty());
    }
}