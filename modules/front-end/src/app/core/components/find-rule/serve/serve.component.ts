import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector: 'app-serve',
  templateUrl: './serve.component.html',
  styleUrls: ['./serve.component.less']
})
export class ServeComponent implements OnInit {

  @Input() isSingle: boolean = false;
  @Input() variationRuleValue: boolean | string;

  @Input('truePercentage')
  set dataTrue(data: number) {
    if(data !== null) {
      this.truePercentage = Number((Number(data.toFixed(2)) * 100).toFixed(0));
      this.falsePercentage = 100 - this.truePercentage;
    } else {
      this.truePercentage = data;
      this.falsePercentage = data;
    }
  };

  @Output() onPercentageChange = new EventEmitter<{ serve: boolean | string, T: number, F: number }>();

  public truePercentage: number = null;
  public falsePercentage: number = null;

  constructor() { }

  ngOnInit(): void {
  }

  public modelChange() {
    if(this.variationRuleValue === 'null') {
      this.truePercentage = 0;
      this.onSliderChange();
    } else {
      this.truePercentage = null;
      this.falsePercentage = null;
      this.onOutputPercentage();
    }
  }

  // 滑动滑块
  onSliderChange() {
    this.falsePercentage = 100 - this.truePercentage;
    this.onOutputPercentage();
  }

  // 抛出事件
  private onOutputPercentage() {
    this.onPercentageChange.next({
      serve: this.variationRuleValue,
      T: this.truePercentage,
      F: this.falsePercentage
    })
  }
}
