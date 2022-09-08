import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DataSyncComponent } from './data-sync.component';

const routes: Routes = [
  {
    path: '',
    component: DataSyncComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DataSyncRoutingModule { }
