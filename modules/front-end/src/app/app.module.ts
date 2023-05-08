import { LOCALE_ID, NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HTTP_INTERCEPTORS, HttpClientModule } from "@angular/common/http";
import { RequestResponseInterceptor } from "@interceptors/request-response.interceptor";
import { NZ_I18N, zh_CN, en_US } from "ng-zorro-antd/i18n";
import { BrowserAnimationsModule } from "@angular/platform-browser/animations";
import { IconsProviderModule } from "./icons-provider.module";
import { NzLayoutModule } from "ng-zorro-antd/layout";
import { NzMessageModule } from "ng-zorro-antd/message";
import { FormsModule } from "@angular/forms";
import { NzSelectModule } from "ng-zorro-antd/select";
import { AccountProjectEnvResolver } from "@services/account-preject-env-resolver.service";

// ngx-markdown is using Marked parser
import 'marked'
import { MarkdownModule } from "ngx-markdown";

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    HttpClientModule,
    BrowserAnimationsModule,
    IconsProviderModule,
    NzLayoutModule,
    NzMessageModule,
    NzSelectModule,
    MarkdownModule.forRoot()
  ],
  providers: [
    AccountProjectEnvResolver,
    {
      provide: NZ_I18N,
      useFactory: (localId: string) => {
        switch (localId) {
          case 'en':
            return en_US;
          case 'zh':
            return zh_CN;
          default:
            return en_US;
        }
      },
      deps: [LOCALE_ID]
    },
    { provide: HTTP_INTERCEPTORS, useClass: RequestResponseInterceptor, multi: true },
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
