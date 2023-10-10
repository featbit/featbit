export interface IResetPasswordResult {
  success: boolean
  reason: string
}

export enum UserOriginEnum {
  Sso = 'Sso',
  Local = 'Local'
}
