import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DetailsComponent } from './details/details.component';
import { DetailsResolver } from './details/details.resolver';
import { IndexComponent } from './index/index.component';

const routes: Routes = [
  {
    path: '',
    component: IndexComponent
  }, {
    path: ':id',
    component: DetailsComponent,
    resolve: { envUser: DetailsResolver },
    data: {
      breadcrumb: (data: any) => data.envUser?.name || data.envUser?.keyId,
    }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class RelayProxiesRoutingModule { }
