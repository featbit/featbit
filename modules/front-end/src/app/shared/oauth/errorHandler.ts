import { RemoteError } from './remoteError';
import { HttpErrorResponse } from "@angular/common/http";

/*
 * Shared error utility functions
 */
export class ErrorHandler {

  /*
   * Handle errors making OAuth or API calls
   */
  public static handleFetchError(err: HttpErrorResponse): RemoteError {
    if (err instanceof RemoteError) {
      return err;
    }

    let message = `Problem encountered calling the ${err.url}: ${err.message}`;
    return new RemoteError(err.status, err.statusText, message);
  }
}
