import { NgModule } from '@angular/core';
import { AccessTokensRoutingModule } from './access-tokens-routing.module';
import { CommonModule } from '@angular/common';
import { AccessTokensComponent } from "@features/safe/integrations/access-tokens/access-tokens.component";

@NgModule({
  declarations: [
    AccessTokensComponent
  ],
  imports: [
    CommonModule,
    AccessTokensRoutingModule
  ],
  providers: [
  ]
})
export class AccessTokensModule { }
