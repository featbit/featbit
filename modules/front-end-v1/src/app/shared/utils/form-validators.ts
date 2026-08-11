import { FormControl, FormGroup, ValidationErrors, ValidatorFn, Validators } from "@angular/forms";

export const PHONE_NUMBER_PATTERN =
  "^(?:\\+?86)?1(?:3\\d{3}|5[^4\\D]\\d{2}|8\\d{3}|7(?:[0-35-9]\\d{2}|4(?:0\\d|1[0-2]|9\\d))|9[0-35-9]\\d{2}|6[2567]\\d{2}|4[579]\\d{2})\\d{6}$";
export const EMAIL_PATTERN =
  /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

export const phoneNumberValidator = Validators.pattern(PHONE_NUMBER_PATTERN);

export const repeatPasswordValidator: ValidatorFn = (control: FormGroup): ValidationErrors | null => {
  const password = control.get('password');
  const _password = control.get('_password');

  if (!_password) {
    const error = { required: true };
    _password.setErrors(error);
    return error;
  }

  if (password.value !== _password.value) {
    const error = { mismatch: true };
    _password.setErrors(error);
    return error;
  }

  _password.setErrors(null);
  return null;
};

export const phoneNumberOrEmailValidator: ValidatorFn = (control: FormControl) => {
  const value = control.value;
  if (!value) {
    const error = { required: true };
    control.setErrors(error);
    return error;
  }

  if (value.match(PHONE_NUMBER_PATTERN)) {
    control.setErrors(null);
    return null;
  }

  if (value.match(EMAIL_PATTERN)) {
    control.setErrors(null);
    return null;
  }

  const error = { invalid: true };
  control.setErrors(error);
  return error;
};

export const urlValidator: ValidatorFn = (control: FormControl) => {
  let isValid = false;

  try {
    const newUrl = new URL(control.value);
    isValid = newUrl.protocol === 'http:' || newUrl.protocol === 'https:';
  } catch (err) {
  }

  return isValid ? null : { invalid: true };
}