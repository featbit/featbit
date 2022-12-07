export interface IAuditLogListModel {
  items: IAuditLog[];
  totalCount: number;
}

export enum RefTypeEnum {
  Flag = 'FeatureFlag'
}

export interface IAuditLog {
  id: string;
  refId: string;
  refType: string;
  operation: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  createdAt: Date;
  comment: string;
}

export class AuditLogListFilter {
  constructor(
    public query?: string,
    public creatorId?: string,
    public refType?: RefTypeEnum,
    public range: Date[] = [],
    public pageIndex: number = 1,
    public pageSize: number = 10
  ) {
  }
}

export class AuditLog {
  private readonly data: IAuditLog;


  constructor(segment: IAuditLog) {
    this.data = {...segment};
  }

  get auditLog() {
    return {...this.data};
  }

  // get dataToSave() {
  //   try{
  //     this.data.rules = handleRulesBeforeSave(this.data.rules);
  //
  //     return {
  //       ...this.data,
  //       included: this._includedUsers.map(u => u.keyId),
  //       excluded: this._excludedUsers.map(u => u.keyId)
  //     };
  //   } catch (err){
  //     console.log(err);
  //   }
  // }
}
