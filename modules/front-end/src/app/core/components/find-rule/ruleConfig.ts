export interface IRuleOp {
    label: string;
    value: string;
    type?: string;
    default?: string;
}

export const ruleOps: IRuleOp[] = [
    {
        label: $localize `:@@core.components.findrule.operators.istrue:is true`,
        value: 'IsTrue',
        type: 'boolean',
        default: 'IsTrue'
    },{
        label: $localize `:@@core.components.findrule.operators.isfalse:is false`,
        value: 'IsFalse',
        type: 'boolean',
        default: 'IsFalse'
    },{
        label: $localize `:@@core.components.findrule.operators.equals:equals`,
        value: 'Equal',
        type: 'string'
    },{
        label: $localize `:@@core.components.findrule.operators.notequal:not equal`,
        value: 'NotEqual',
        type: 'string',
        default: ''
    },{
        label: $localize `:@@core.components.findrule.operators.lessthan:less than`,
        value: 'LessThan',
        type: 'number',
        default: ''
    },{
        label: $localize `:@@core.components.findrule.operators.biggerthan:bigger than`,
        value: 'BiggerThan',
        type: 'number',
        default: ''
    },{
        label: $localize `:@@core.components.findrule.operators.lessequalthan:less equal than`,
        value: 'LessEqualThan',
        type: 'number',
        default: ''
    },{
        label: $localize `:@@core.components.findrule.operators.biggerequalthan:bigger equal than`,
        value: 'BiggerEqualThan',
        type: 'number',
        default: ''
    },{
        label: $localize `:@@core.components.findrule.operators.isoneof:is one of`,
        value: 'IsOneOf',
        type: 'multi',
        default: ''
    },{
        label: $localize `:@@core.components.findrule.operators.notoneof:not one of`,
        value: 'NotOneOf',
        type: 'multi',
        default: ''
    },{
        label: $localize `:@@core.components.findrule.operators.contains:contains`,
        value: 'Contains',
        type: 'string',
        default: ''
    },{
        label: $localize `:@@core.components.findrule.operators.notcontain:not contain`,
        value: 'NotContain',
        type: 'string',
        default: ''
    },{
        label: $localize `:@@core.components.findrule.operators.startwith:start with`,
        value: 'StartsWith',
        type: 'string',
        default: ''
    },{
        label: $localize `:@@core.components.findrule.operators.endswith:ends with`,
        value: 'EndsWith',
        type: 'string',
        default: ''
    },{
      label: $localize `:@@core.components.findrule.operators.matchregex:match regex`,
      value: 'MatchRegex',
      type: 'regex',
      default: ''
    },{
      label: $localize `:@@core.components.findrule.operators.notmatchregex:not match regex`,
      value: 'NotMatchRegex',
      type: 'regex',
      default: ''
  }
]

export function findIndex(id: string) {
    return ruleOps.findIndex((item: IRuleOp) => item.value === id);
}
