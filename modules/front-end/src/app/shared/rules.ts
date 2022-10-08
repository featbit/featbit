export interface ISegmentRule {
  id: string,
  name: string,
  conditions: ICondition[]
}

export interface ICondition {
  property: string,
  op: string,
  value: string,

  multipleValue?: string[];
  type?: string;
}
