import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { SwitchArchiveComponent } from './switch-archive.component';

const routes: Routes = [
  {
    path: '',
    component: SwitchArchiveComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class SwitchArchiveRoutingModule { }
