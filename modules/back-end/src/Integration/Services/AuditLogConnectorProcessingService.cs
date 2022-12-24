using Application.AuditLogs;
using Infrastructure.AuditLogs;

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
        private readonly IAuditLogConnectorService _auditLogService;

        public AuditLogConnectorProcessingService(ILogger<AuditLogConnectorProcessingService> logger,
            IAuditLogConnectorService auditLogService)
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

                var auditLogs = await _auditLogService.GetListByCreateAtAsync(
                    new DateTime(2022, 12, 21, 12, 30, 0, DateTimeKind.Utc),
                    50);

                await Task.Delay(12000, stoppingToken);
            }
        }
    }
}
