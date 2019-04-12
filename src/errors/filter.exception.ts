import { GeneralException } from "./general.exception";

export class FilterException extends GeneralException {
    constructor(msg?: string, stack?: string) {
        super(`
        FilterException has been detected, ${msg ? msg + "," : ""}
        `, stack);
    }
}
