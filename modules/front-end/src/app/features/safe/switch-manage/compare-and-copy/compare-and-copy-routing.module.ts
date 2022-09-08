import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CompareAndCopyComponent } from './compare-and-copy.component';


const routes: Routes = [
  {
    path: '',
    data: {
      breadcrumb: '开关对比与复制'
    },
    component: CompareAndCopyComponent,
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
  providers: [
  ]
})
export class CompareAndCopyRoutingModule { }
