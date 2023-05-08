import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { copyToClipboard } from "@utils/index";
import { NzMessageService } from "ng-zorro-antd/message";

import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-go';

// import more languages on-demand

@Component({
  selector: 'prism',
  templateUrl: './prism.component.html',
  styleUrls: ['./prism.component.less']
})
export class PrismComponent implements AfterViewInit {
  private _code: string;
  @Input()
  set code(value: string) {
    this._code = value.trimEnd();
    this.highlight();
  }

  get code(): string {
    return this._code;
  }

  @Input() language: string = 'javascript';

  @ViewChild('codeElement') codeEle: ElementRef;

  constructor(private message: NzMessageService) {
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
