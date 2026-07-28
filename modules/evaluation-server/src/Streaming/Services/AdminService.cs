using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using Streaming.Connections;
using Streaming.Protocol;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Streaming.Services
{
    public class AdminService(
        IConnectionManager connectionManager,
        IDataSyncService dataSyncService,
        StreamingOptions options,
        ILogger<AdminService> logger)
        : IAdminService
    {

        public async Task<ICollection<Connection>> GetConnections()
        {
            return connectionManager.GetAllConnections();
        }
        
        public async Task PushFullSyncToAllActiveSdks()
        {
            var connections = connectionManager.GetAllConnections();
            var groupedByEnv = connections.GroupBy(c => c.EnvId);

            // Bound CPU / GC / network pressure during the refresh. The cap is shared
            // across all envs and all connections in this push so two large envs cannot together
            // burst to 2x the configured cap.
            var maxConcurrency = Math.Max(1, options.PushFullSyncMaxConcurrency);
            using var sendGate = new SemaphoreSlim(maxConcurrency, maxConcurrency);

            foreach (var group in groupedByEnv)
            {
                var envId = group.Key;
                try
                {
                    await PushEnvFullSyncAsync(envId, group.ToList(), sendGate);
                }
                catch (Exception ex)
                {
                    // One env failing must not stop the refresh of other envs.
                    logger.LogError(ex, "Push full sync failed for env {EnvId}; continuing with remaining envs", envId);
                }
            }
        }

        private async Task PushEnvFullSyncAsync(Guid envId, List<Connection> envConnections, SemaphoreSlim sendGate)
        {
            // Connection.Type derives from Secret.Type, which is only "server" or "client".
            // RelayProxy-backed connections are stored in the manager as their mapped server
            // connections (each carrying a server secret) and are picked up by the server filter
            // below — there is no separate ConnectionType.RelayProxy bucket to skip here.
            var serverConnections = envConnections
                .Where(c => c.Type == ConnectionType.Server)
                .ToList();

            // Client SDKs need a per-user evaluated payload. A client connection without an
            // attached user has not yet completed its identify handshake; skip it — it will
            // receive a fresh payload as part of its own dataSync flow once it identifies.
            var clientConnections = envConnections
                .Where(c => c.Type == ConnectionType.Client && c.User != null)
                .ToList();

            var skippedUnidentifiedClientCount = envConnections
                .Count(c => c.Type == ConnectionType.Client && c.User == null);

            if (serverConnections.Count == 0 && clientConnections.Count == 0)
            {
                if (skippedUnidentifiedClientCount > 0)
                {
                    logger.LogInformation(
                        "Env {EnvId}: skipped {UnidentifiedClientCount} unidentified client connections; no eligible connections to push to",
                        envId, skippedUnidentifiedClientCount);
                }
                return;
            }

            var failures = new ConcurrentBag<(string ConnectionId, Exception Exception)>();

            // Server SDKs: build one payload for the env and fan out to every server connection
            // in that env.
            if (serverConnections.Count > 0)
            {
                ServerSdkPayload? serverPayload = null;
                try
                {
                    serverPayload = await dataSyncService.GetServerSdkPayloadAsync(envId, 0);
                }
                catch (Exception ex)
                {
                    logger.LogError(
                        ex,
                        "Failed to build server SDK payload for env {EnvId}; skipping {ServerCount} server connections in this env",
                        envId, serverConnections.Count);
                }

                if (serverPayload != null)
                {
                    var serverMessage = new ServerMessage(MessageTypes.DataSync, serverPayload);

                    var serverTasks = serverConnections.Select(connection =>
                        GatedServerSendAsync(connection, serverMessage, sendGate, failures));

                    await Task.WhenAll(serverTasks);
                }
            }

            // Client SDKs: evaluate per connection using its attached user. Each connection
            // gets its own payload and its own ServerMessage instance. A failure for one
            // connection (build or send) is isolated and does not affect the others.
            if (clientConnections.Count > 0)
            {
                var clientTasks = clientConnections.Select(connection =>
                    GatedClientWorkAsync(connection, envId, sendGate, failures));

                await Task.WhenAll(clientTasks);
            }

            logger.LogInformation(
                "Env {EnvId}: pushed full sync to {ServerCount} server and {ClientCount} client connections (skipped {UnidentifiedClientCount} unidentified client)",
                envId,
                serverConnections.Count,
                clientConnections.Count,
                skippedUnidentifiedClientCount);

            foreach (var (connectionId, ex) in failures)
            {
                logger.LogError(ex, "Push full sync send failed for connection {ConnectionId} in env {EnvId}", connectionId, envId);
            }
        }

        private static async Task GatedServerSendAsync(
            Connection connection,
            ServerMessage message,
            SemaphoreSlim sendGate,
            ConcurrentBag<(string ConnectionId, Exception Exception)> failures)
        {
            await sendGate.WaitAsync();
            try
            {
                await connection.SendAsync(message, CancellationToken.None);
            }
            catch (Exception ex)
            {
                failures.Add((connection.Id, ex));
            }
            finally
            {
                sendGate.Release();
            }
        }

        private async Task GatedClientWorkAsync(
            Connection connection,
            Guid envId,
            SemaphoreSlim sendGate,
            ConcurrentBag<(string ConnectionId, Exception Exception)> failures)
        {
            await sendGate.WaitAsync();
            try
            {
                var clientPayload = await dataSyncService.GetClientSdkPayloadAsync(envId, connection.User!, 0);
                var clientMessage = new ServerMessage(MessageTypes.DataSync, clientPayload);
                await connection.SendAsync(clientMessage, CancellationToken.None);
            }
            catch (Exception ex)
            {
                failures.Add((connection.Id, ex));
            }
            finally
            {
                sendGate.Release();
            }
        }
    }
}