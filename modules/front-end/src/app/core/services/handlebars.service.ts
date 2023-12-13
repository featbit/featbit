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

  private registerHelpers() {
    Handlebars.registerHelper('eq', function(a, b, options) {
      return a === b ? options.fn(this) : options.inverse(this);
    });
  }
}