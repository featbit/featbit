import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { copyToClipboard } from "@utils/index";
import { NzMessageService } from "ng-zorro-antd/message";

import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-bash';
import 'prismjs/plugins/normalize-whitespace/prism-normalize-whitespace'

@Component({
  selector: 'prism',
  templateUrl: './prism.component.html',
  styleUrls: ['./prism.component.less']
})
export class PrismComponent implements AfterViewInit {
  private _code: string;
  @Input()
  set code(value: string) {
    this._code = value;
    this.highlight();
  }

  get code(): string {
    return this._code;
  }

  @Input() language: string = 'javascript';

  @ViewChild('codeElement') codeEle: ElementRef;

  constructor(private message: NzMessageService) {
    Prism.plugins.NormalizeWhitespace.setDefaults({
      'remove-trailing': true,
      'remove-indent': true,
      'left-trim': true,
      'break-lines': 105,
      'right-trim': true,
      'remove-initial-line-feed': false
    });
  }

  ngAfterViewInit() {
    this.highlight();
  }

  highlight() {
    if (this.codeEle) {
      let nativeEl = this.codeEle.nativeElement;
      nativeEl.textContent = this._code;
      Prism.highlightElement(nativeEl);
    }
  }

  copyCode() {
    copyToClipboard(this.code).then(
      () => this.message.success($localize`:@@common.copy-success:Copied`)
    );
  }
}
