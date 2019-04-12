export declare class Error {
    public name: string;
    public message: string;
    public stack: string;
    constructor(message?: string);
}
  
export class GeneralException extends Error {
    constructor(private readonly msg = ``, stack?: string) {
        super(msg);
        stack ? this.stack = stack : null;
    }

    public desc() {
        return this.msg;
    }
}
