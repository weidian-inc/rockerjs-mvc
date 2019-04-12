import { GeneralException } from "./general.exception";

export class ApplicationException extends GeneralException {
    constructor(msg?: string, stack?: string) {
        super(`
        ApplicationException has been detected, ${msg ? msg + "," : ""}
        `, stack);
    }
}
