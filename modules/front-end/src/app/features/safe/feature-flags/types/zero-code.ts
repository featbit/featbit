import { IVariationOption } from "./switch-new";

export interface IZeroCode {
  envId: number,
  envSecret: string,
  isActive: boolean,
  featureFlagId: string,
  featureFlagKey: string,
  items: ICssSelectorItem[]
}

export interface IHtmlProperty {
  id: string,
  name: string,
  value: string
}

export interface ICssSelectorItem {
  id: string,
  cssSelector: string,
  description: string,
  variationOption: IVariationOption,
  action: string,
  htmlProperties: IHtmlProperty[],
  htmlContent: string,
  style: string,
  url: string
}
