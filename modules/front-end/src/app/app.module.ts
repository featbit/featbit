import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NzCodeEditorModule } from 'ng-zorro-antd/code-editor';
import {HTTP_INTERCEPTORS} from "@angular/common/http";
import {TokenInterceptor} from "./core/interceptors/token.interceptor";
import {NZ_I18N, zh_CN} from "ng-zorro-antd/i18n";

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    NzCodeEditorModule
  ],
  providers: [
    { provide: NZ_I18N, useValue: zh_CN },
    { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
