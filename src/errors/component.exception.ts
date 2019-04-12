import { GeneralException } from "./general.exception";

export class ComponentException extends GeneralException {
    constructor(msg?: string, stack?: string) {
        super(`
        ComponentException has been detected, ${msg ? msg + "," : ""}
        `, stack);
    }
}
