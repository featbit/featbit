import { createInterface } from 'node:readline';

export class ProbeSessionError extends Error {
  retryable = false;
}

export function createProbeReader(child, getStderr, timeout = 10_000) {
  const reader = createInterface({ input: child.stdout });
  let terminalError;
  let pending = false;

  return {
    async read() {
      if (terminalError) throw terminalError;
      if (child.exitCode !== null) {
        throw new ProbeSessionError(`Server SDK probe exited: ${getStderr()}`);
      }
      if (pending) throw new ProbeSessionError('Server SDK probe has a pending response');
      pending = true;
      return new Promise((resolve, reject) => {
        let timer;
        const finish = (error, line) => {
          clearTimeout(timer);
          reader.off('line', onLine);
          reader.off('close', onClose);
          pending = false;
          error ? reject(error) : resolve(line);
        };
        const onLine = line => finish(null, line);
        const onClose = () => {
          terminalError = new ProbeSessionError(`Server SDK probe exited: ${getStderr()}`);
          finish(terminalError);
        };
        reader.once('line', onLine);
        reader.once('close', onClose);
        timer = setTimeout(() => {
          terminalError = new ProbeSessionError('Server SDK probe timed out');
          finish(terminalError);
          child.kill();
        }, timeout);
        child.stdin.write('evaluate\n');
      });
    },
    close() { reader.close(); },
  };
}
