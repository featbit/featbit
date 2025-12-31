import { IRuleOp, RULE_OPS } from "@shared/rules";

export function findIndex(id: string) {
    return RULE_OPS.findIndex((item: IRuleOp) => item.value === id);
}
