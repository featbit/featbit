using Application.AuditLogs;
using Application.Services;

namespace FeatBit.Integration.Backend.Services
{
    public interface IAuditLogConnectorProcessingService
    {
        Task DoWork(CancellationToken stoppingToken);
    }

    public class AuditLogConnectorProcessingService: IAuditLogConnectorProcessingService
    {
        private int executionCount = 0;
        private readonly ILogger _logger;
        private readonly IAuditLogService _auditLogService;

        public AuditLogConnectorProcessingService(ILogger<AuditLogConnectorProcessingService> logger,
            IAuditLogService auditLogService)
        {
            _logger = logger;
            _auditLogService = auditLogService;
        }

        public async Task DoWork(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                executionCount++;

                _logger.LogInformation(
                    "Scoped Processing Service is working. Count: {Count}", executionCount);

                var auditLogs = await _auditLogService.GetListAsync(
                    new Guid("3f3896b7-9870-4e1c-aa62-10d14540bca7"),
                    new AuditLogFilter
                    {
                        PageIndex = 0,
                        PageSize = 50,
                    });

                await Task.Delay(12000, stoppingToken);
            }
        }
    }
}
