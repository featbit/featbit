import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { InitializationComponent } from './initialization.component';

const routes: Routes = [
  {
    path: '',
    component: InitializationComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
  providers: [
  ]
})
export class InitializationRoutingModule { }
