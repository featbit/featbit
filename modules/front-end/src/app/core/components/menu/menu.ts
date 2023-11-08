export interface IMenuItem {
    title?: string
    line?: boolean
    icon?: string
    path?: string
    target?: string
    open?: boolean
    selected?: boolean
    disabled?: boolean
    children?: IMenuItem[],
    hide?: boolean
}
