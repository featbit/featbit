import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { copyToClipboard } from "@utils/index";
import { NzMessageService } from "ng-zorro-antd/message";

import Prism from 'prismjs';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-csharp';

// import more languages on-demand

@Component({
  selector: 'prism',
  templateUrl: './prism.component.html',
  styleUrls: ['./prism.component.less']
})
export class PrismComponent implements AfterViewInit {
  @Input() code: string;
  @Input() language: string;

  @ViewChild('codeElement') codeEle!: ElementRef;

  constructor(private message: NzMessageService) {
  }

  ngAfterViewInit(): void {
    Prism.highlightElement(this.codeEle.nativeElement);
  }

  copyCode() {
    copyToClipboard(this.code).then(
      () => this.message.success($localize`:@@common.copy-success:Copied`)
    );
  }
}
