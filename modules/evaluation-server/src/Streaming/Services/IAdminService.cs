using Streaming.Connections;
using System.Collections.Generic;

namespace Streaming.Services;

public interface IAdminService
{
    /// <summary>
    /// Pushes a full data-sync payload to all currently connected SDK consumers — both
    /// <see cref="ConnectionType.Server"/> and <see cref="ConnectionType.Client"/>.
    /// </summary>
    /// <remarks>
    /// <para>
    /// This is an operator-initiated refresh path used when every active SDK needs to
    /// rebuild its in-memory state immediately.
    /// </para>
    /// <para>
    /// Server SDKs receive a single <c>ServerSdkPayload</c> per environment (raw flag and segment
    /// definitions), shared across every server connection in that environment.
    /// </para>
    /// <para>
    /// Client SDKs receive a per-connection <c>ClientSdkPayload</c> built from the
    /// <c>EndUser</c> attached to that connection. Client connections that have not yet completed
    /// their identify handshake (no attached user) are skipped — they will receive a fresh payload
    /// as part of their normal dataSync flow once they identify.
    /// </para>
    /// <para>
    /// Failures are isolated: a single connection's send error, a single client's evaluation
    /// failure, or a single env's server-payload build failure never blocks the rest of the work.
    /// </para>
    /// </remarks>
    Task PushFullSyncToAllActiveSdks();

    Task<ICollection<Connection>> GetConnections();
}