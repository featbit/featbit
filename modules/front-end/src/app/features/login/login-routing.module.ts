import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DoLoginComponent } from './do-login/do-login.component';
import { ForgetComponent } from './forget/forget.component';
import { LoginComponent } from './login.component';
import { RegisterComponent } from './register/register.component';

const routes: Routes = [
  {
    path: '',
    component: LoginComponent,
    children: [
      {
        path: '',
        component: DoLoginComponent
      },
      {
        path: 'register',
        component: RegisterComponent
      },
      {
        path: 'forget-password',
        component: ForgetComponent
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LoginRoutingModule { }
