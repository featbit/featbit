import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { CheckoutResultComponent } from './checkout-result.component';

const routes: Routes = [
  { path: 'success', component: CheckoutResultComponent, data: { success: true } },
  { path: 'cancel', component: CheckoutResultComponent, data: { success: false } },
];

@NgModule({
  declarations: [CheckoutResultComponent],
  imports: [
    CommonModule,
    NzResultModule,
    NzButtonModule,
    RouterModule.forChild(routes)
  ]
})
export class CheckoutModule {}
