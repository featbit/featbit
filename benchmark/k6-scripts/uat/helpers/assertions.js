import { check } from 'k6';

export function assertConnected(statusResponse, instanceId) {
  return check(statusResponse, {
    [`${instanceId}: connectionState is Connected`]: (r) =>
      r.connectionState === 'Connected',
  });
}

export function assertDisconnected(statusResponse, instanceId) {
  return check(statusResponse, {
    [`${instanceId}: connectionState is Disconnected`]: (r) =>
      r.connectionState === 'Disconnected',
  });
}

export function assertFullSyncReceived(statusResponse, priorCount, instanceId) {
  const countIncreased = check(statusResponse, {
    [`${instanceId}: dataSyncEventCount increased`]: (r) =>
      r.dataSyncEventCount > priorCount,
  });

  let eventTypeFull = false;
  if (
    statusResponse.dataSyncEventsReceived &&
    statusResponse.dataSyncEventsReceived.length > 0
  ) {
    const latest =
      statusResponse.dataSyncEventsReceived[
        statusResponse.dataSyncEventsReceived.length - 1
      ];
    eventTypeFull = check(latest, {
      [`${instanceId}: latest event is full sync`]: (evt) =>
        evt.eventType === 'full',
    });
  }

  return countIncreased && eventTypeFull;
}
