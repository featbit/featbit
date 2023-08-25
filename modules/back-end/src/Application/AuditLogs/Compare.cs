using Application.Bases;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Segments;
using Domain.SemanticPatch;

namespace Application.AuditLogs;

public class Compare : IRequest<IEnumerable<Instruction>>
{
    public string RefType { get; set; }
    
    public DataChange DataChange { get; set; }
}

public class CompareValidator : AbstractValidator<Compare>
{
    public CompareValidator()
    {
        RuleFor(x => x.RefType)
            .Must(AuditLogRefTypes.IsDefined)
            .WithErrorCode(ErrorCodes.Invalid("RefType"));
        
        RuleFor(x => x.DataChange)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Invalid("DataChange"));
        
        RuleFor(x => x.DataChange.Previous)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.InvalidPreviousValue);
        
        RuleFor(x => x.DataChange.Current)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.InvalidCurrentValue);
    }
}

public class CompareHandler : IRequestHandler<Compare, IEnumerable<Instruction>>
{
    public async Task<IEnumerable<Instruction>> Handle(Compare request, CancellationToken cancellationToken)
    {
        switch (request.RefType)
        {
            case AuditLogRefTypes.FeatureFlag:
                var previousFlag = request.DataChange.DeserializePrevious<FeatureFlag>();
                var currentFlag = request.DataChange.DeserializeCurrent<FeatureFlag>();
                return FlagComparer.Compare(previousFlag, currentFlag);
            case AuditLogRefTypes.Segment:
                var previousSegment = request.DataChange.DeserializePrevious<Segment>();
                var currentSegment = request.DataChange.DeserializeCurrent<Segment>();
                return SegmentComparer.Compare(previousSegment, currentSegment);
            default:
                return new List<Instruction>();
        }
    }
}