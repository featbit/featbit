import { Injectable } from "@angular/core";

import Handlebars from 'handlebars/lib/handlebars';

@Injectable({
  providedIn: 'root',
})

export class HandlebarsService {

  private _initialized = false;

  init() {
    if (this._initialized) {
      return;
    }

    this.registerHelpers();

    this._initialized = true;
  }

  compile(template: string, data: any) {
    const compiled = Handlebars.compile(template);
    return compiled(data);
  }

  private registerHelpers() {
    Handlebars.registerHelper('eq', function (a, b, options) {
      return a === b ? options.fn(this) : options.inverse(this);
    });

    Handlebars.registerHelper('json', function (obj) {
      // disable HTML-escaping of return values
      // ref: https://handlebarsjs.com/guide/expressions.html#prevent-html-escaping-of-helper-return-values
      return new Handlebars.SafeString(JSON.stringify(obj, null, 2));
    });
  }
}