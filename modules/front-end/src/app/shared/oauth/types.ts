export interface StartAuthorizationResponse {
  authorizationRequestUrl: string
}

export interface EndAuthorizationResponse {
  handled: boolean;
  isLoggedIn: boolean;
  csrf: string;
}

export interface LogoutUserResponse {
  url: string;
}
