import { Injectable } from "@angular/core";
import { AbstractControl, AsyncValidator, ValidationErrors } from "@angular/forms";
import { Observable } from "rxjs";
import { debounceTime, first, map, switchMap } from "rxjs/operators";
import { FeatureFlagService } from "@services/feature-flag.service";

@Injectable({ providedIn: 'root' })
export class FlagKeyValidator implements AsyncValidator {
  constructor(private flagService: FeatureFlagService) {
  }

  validate(control: AbstractControl): Promise<ValidationErrors | null> | Observable<ValidationErrors | null> {
    return control.valueChanges.pipe(
      debounceTime(300),
      switchMap(value => this.flagService.isKeyUsed(value as string)),
      map(isKeyUsed => {
        switch (isKeyUsed) {
          case true:
            return { error: true, duplicated: true };
          case undefined:
            return { error: true, unknown: true };
          default:
            return null;
        }
      }),
      first()
    );
  }
}
