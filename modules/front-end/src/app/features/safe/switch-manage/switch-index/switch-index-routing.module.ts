import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SwitchIndexComponent } from './switch-index.component';

const routes: Routes = [{
  path: '',
  data: { title: 'index' },
  component: SwitchIndexComponent
}];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SwitchIndexRoutingModule { }
