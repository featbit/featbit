export interface ruleType {
    label: string;
    value: string;
    type?: string;
    default?: string;
}

export const ruleKeyConfig: ruleType[] = [
    {
        label: 'KeyId',
        value: 'KeyId'
    },{
        label: 'Name',
        value: 'Name'
    },{
        label: 'Email',
        value: 'Email'
    },{
        label: 'Customized Properties',
        value: 'Properties'
    }
]

export const ruleValueConfig: ruleType[] = [
    {
        label: '为真',
        value: 'IsTrue',
        type: '',
        default: 'IsTrue'
    },{
        label: '为假',
        value: 'IsFalse',
        type: '',
        default: 'IsFalse'
    },{
        label: '等于',
        value: 'Equal',
        type: 'string'
    },{
        label: '不等于',
        value: 'NotEqual',
        type: 'string',
        default: ''
    },{
        label: '小于',
        value: 'LessThan',
        type: 'number',
        default: ''
    },{
        label: '大于',
        value: 'BiggerThan',
        type: 'number',
        default: ''
    },{
        label: '小于等于',
        value: 'LessEqualThan',
        type: 'number',
        default: ''
    },{
        label: '大于等于',
        value: 'BiggerEqualThan',
        type: 'number',
        default: ''
    },{
        label: '属于',
        value: 'IsOneOf',
        type: 'multi',
        default: ''
    },{
        label: '不属于',
        value: 'NotOneOf',
        type: 'multi',
        default: ''
    },{
        label: '包含',
        value: 'Contains',
        type: 'string',
        default: ''
    },{
        label: '不包含',
        value: 'NotContain',
        type: 'string',
        default: ''
    },{
        label: '以指定字符串开头',
        value: 'StartsWith',
        type: 'string',
        default: ''
    },{
        label: '以指定字符串结尾',
        value: 'EndsWith',
        type: 'string',
        default: ''
    },{
      label: '正则匹配',
      value: 'MatchRegex',
      type: 'regex',
      default: ''
    },{
      label: '正则不匹配',
      value: 'NotMatchRegex',
      type: 'regex',
      default: ''
  }
]

export function findIndex(id: string) {
    return ruleValueConfig.findIndex((item: ruleType) => item.value === id);
}
