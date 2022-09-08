import {IUserProp} from "@shared/types";

export const USER_IS_IN_SEGMENT = 'User is in segment';

export const USER_IS_NOT_IN_SEGMENT = 'User is not in segment';

export const USER_BUILT_IN_PROPERTIES = ["KeyId", "Name", "Email", "Country"];

export const USER_IS_IN_SEGMENT_USER_PROP: IUserProp = {
  id: 'faff2c24-ee62-4663-8d65-165f320c4a69',
  name: USER_IS_IN_SEGMENT,
  presetValues: [],
  usePresetValuesOnly: false,
  isBuiltIn: true,
  isArchived: false,
  isDigestField: false,
  remark: ''
};

export const USER_IS_NOT_IN_SEGMENT_USER_PROP: IUserProp = {
  id: '3988dbe8-80c1-4425-ae50-8c83416d806b',
  name: USER_IS_NOT_IN_SEGMENT,
  presetValues: [],
  usePresetValuesOnly: false,
  isBuiltIn: true,
  isArchived: false,
  isDigestField: false,
  remark: ''
};
