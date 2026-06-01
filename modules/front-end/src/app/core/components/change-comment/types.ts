export enum ChangeOperation {
  ToggleOn = 'ToggleOn',
  ToggleOff = 'ToggleOff',
  ChangeName = 'ChangeName',
  ChangeDescription = 'ChangeDescription',
  ChangeVariations = 'ChangeVariations',
  ChangeOffVariation = 'ChangeOffVariation',
  AddTag = 'AddTag',
  RemoveTag = 'RemoveTag',
  Archive = 'Archive',
  Restore = 'Restore',
  Delete = 'Delete',
  ChangeTargeting = 'ChangeTargeting',
}

export interface ChangeCommentData {
  resourceType: 'flag' | 'segment';
  resourceKey: string;
  operation: ChangeOperation;
}

export const OperationDescriptions: Record<ChangeOperation, string> = {
  [ChangeOperation.ToggleOn]: "Are you sure to turn it on? After turned on, the flag will return the serving variation that matches the targeted users or rules.",
  [ChangeOperation.ToggleOff]: "Are you sure to turn it off? After turned off, the flag will return the variation that you specified for its off state.",
  [ChangeOperation.ChangeName]: "You're going to change the name of the {type}.",
  [ChangeOperation.ChangeDescription]: "You're going to change the description of the {type}.",
  [ChangeOperation.ChangeVariations]: "You're going to change the variations of the {type}.",
  [ChangeOperation.ChangeOffVariation]: "You're going to change the off variation of the {type}.",
  [ChangeOperation.AddTag]: "You're going to add a tag to the {type}.",
  [ChangeOperation.RemoveTag]: "You're going to remove a tag from the {type}.",
  [ChangeOperation.Archive]: "Are you sure to archive this {type}? After archiving, the fallback value defined in your code will be returned for all users.",
  [ChangeOperation.Restore]: "You're going to restore the {type}.",
  [ChangeOperation.Delete]: "You're going to permanently delete the {type}.",
  [ChangeOperation.ChangeTargeting]: "You're going to change the targeting rules of the {type}.",
};
