
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


// export interface menuInterface {
//     id?: string;
//     label?: string;
//     routerURL?: string;
//     isSelected?: boolean;
//     linkURL?: string;
//     type: 'menu' | 'driver' | 'link';
// }

// export class menuConfig {

//     private menuList: menuInterface[];
//     private currentMenuID: string;

//     constructor() {
//         this.menuList = [];
//     }

//     public addMenu(id: string, label: string, url: string) {
//         let menu: menuInterface = {
//             id,
//             label,
//             routerURL: url,
//             type: 'menu',
//             isSelected: false
//         }

//         this.menuList.push(menu);
//     }

//     // 添加分割线
//     public addDriver() {
//         this.menuList.push({
//             type: 'driver'
//         })
//     }

//     // 添加链接
//     public addLink(id: string, label: string, link: string) {
//         this.menuList.push({
//             id,
//             label,
//             linkURL: link,
//             isSelected: false,
//             type: 'link'
//         })
//     }

//     public setCurrentSelectID(id: string) {
//         this.currentMenuID = id;
//     }

//     public getMenuList() {
//         return this.menuList;
//     }

//     public getCurrentSelectID() {
//         return this.currentMenuID;
//     }
// }

