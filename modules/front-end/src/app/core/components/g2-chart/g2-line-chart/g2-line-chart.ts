import {Data, ScaleOption} from "@antv/g2/src/interface";
import {ViewPadding} from "@antv/g2/lib/interface";

export interface AxisConfig {
  readonly name: string;
  readonly field: string;
  readonly position: string;
  readonly formatter?: (text: string) => string;
  readonly scale?: ScaleOption;
}

export interface TooltipConfig {
  readonly tplFormatter?: (tpl: string) => string;
}

export interface ChartConfig {
  readonly source: Data[];
  readonly dataGroupBy?: string;
  readonly xAxis: AxisConfig;
  readonly yAxis: AxisConfig;
  readonly padding: ViewPadding;
  readonly toolTip?: TooltipConfig;
  readonly lineShape?: string;
}

export const defaultTooltipItemTplPlaceholder: string =
  '<li class="g2-tooltip-list-item" data-index={index} style="list-style-type: none; padding: 0px; margin: 12px 0px;">' +
  '<span class="g2-tooltip-marker" style="background: {color}; width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 8px;"></span>' +
  '<span class="g2-tooltip-name">{name}</span>:' +
  `<span class="g2-tooltip-value" style="display: inline-block; float: right; margin-left: 30px;">{value}</span>`
'</li>';
