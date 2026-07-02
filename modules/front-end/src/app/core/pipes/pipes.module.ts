import { NgModule } from "@angular/core";
import { SlugifyPipe } from "@core/pipes/slugify";
import { PercentagePipe } from "@core/pipes/percentage.pipe";
import { PolicyTypePipe } from "@core/pipes/policy-type.pipe";
import { AccessTokenTypePipe } from "@core/pipes/access-token-type.pipe";
import { AccessTokenStatusPipe } from "@core/pipes/access-token-status.pipe";
import { TranslationPipe } from "@core/pipes/translation.pipe";
import { RuleVariationValuePipe } from "@core/components/find-rule/serve/rule-variation-value.pipe";
import { FormatDatePipe } from "@core/pipes/format-date.pipe";

@NgModule({
  declarations: [
    FormatDatePipe,
    SlugifyPipe,
    PercentagePipe,
    PolicyTypePipe,
    AccessTokenTypePipe,
    AccessTokenStatusPipe,
    TranslationPipe,
    RuleVariationValuePipe,
  ],
  imports: [],
  exports: [
    FormatDatePipe,
    SlugifyPipe,
    PercentagePipe,
    PolicyTypePipe,
    AccessTokenTypePipe,
    AccessTokenStatusPipe,
    TranslationPipe,
    RuleVariationValuePipe,
  ]
})
export class PipesModule { }
