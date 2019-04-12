import * as Util from "../util";
import * as FS from "fs";
import * as Path from "path";
import * as Ejs from "ejs";

export const TRACE_ID_KEY_IN_HEADER: string = "X-Trace-Id";

export enum ReqMethodType {
    Head, Get, Post, Delete, Update,
}

export enum ReqMethodParamType {
    Normal, Request, Response, Context,
}

export class RouterPattern {
    public fnPath: Function;
    public urlPattern: string;
    /**
     * Render code like:
     * {'a':'./t.ejs'} or {'a':['./t0.ejs','./t1.ejs']} or './t0.ejs' or ['./t0.ejs','./t1.ejs']
     */
    public render: { path: string, compile: Function}[] | {[index: string]: {path: string, compile: Function}[]};
    public clzMethod: string;

    constructor(fnPath: Function, _clzMethod: string, _config?: RPParam) {
        this.fnPath = fnPath;
        this.clzMethod = _clzMethod;
        if (Util.isEmpty(_config)) {
            this.urlPattern = "/";
        } else if (typeof _config === "string") {
            this.urlPattern = _config as string;
        } else if (typeof _config === "object") {
            this.urlPattern = _config["url"] as string;
            const renderCfg = _config["render"];
            if (renderCfg) {
                const ary = [];
                const th = this;

                const proFn = function(_item) {
                    return {
                        get path() {
                            if (typeof _item === "string") {
                                const rp: string = Path.resolve(Path.dirname(th.fnPath()), _item);
                                if (!FS.existsSync(rp)) {
                                    throw new MVCError(`The template file[${rp}] not Found.`, 404);
                                }
                                return rp;
                            } else {
                                throw new MVCError(`The config: render's item type(string|{[index:string]:string}) error.`, 500);
                            }
                        }, compile(_name: string) {
                            const thPath = this.path;
                            const rp = typeof (thPath) === "object" ? thPath[_name] : thPath;
                            const content = FS.readFileSync(rp, "utf-8"); // Return template's content
                            return Ejs.compile(content, { filename: rp }); // option {filename:...}
                        },
                    };
                };

                // @Get({url:'/multiView',render:{'a':'./tpt.ejs'}})
                if (typeof renderCfg === "object" && !Array.isArray(renderCfg)) {
                    const rtn = {};
                    for (const name in renderCfg) {
                        const tary = [];
                        ((Array.isArray(renderCfg[name]) ? renderCfg[name] : [renderCfg[name]]) as string[])
                            .forEach((_tpt) => tary.push(proFn(_tpt)));
                        rtn[name] = tary;
                    }
                    this.render = rtn;
                    return;
                }

                [].concat(Array.isArray(renderCfg) ? renderCfg : [renderCfg]).forEach((_tpt) => ary.push(proFn(_tpt)));
                this.render = ary;
            }
        }
    }
}

interface RenderDesc {
    url: string;
    render?: string | string[] | {[index: string]: string | string[]};
}

export type ServerFacade = {
    config: Function,
};

export declare type RPParam = RenderDesc | string;

export declare type RouterParamType = {name: string} | {required: boolean} | {name: string, required: boolean} | string;

export type MethodParams = {index: number, name: string, type: ReqMethodParamType, transformer: Function, required: boolean};

/**
 * Router's register
 */
export class RouterForClz {
    public fnPath: Function; // clz's module

    constructor(fnPath: Function) {
        this.fnPath = fnPath;
    }

    public regMethodParam(_name: string, _index: number, _type: ReqMethodParamType, _cfg: RouterParamType, _transformer: Function) {
        let mp: MethodParams[] = this.paramReg.get(_name);
        if (!mp) {
            mp = new Array<MethodParams>();
            this.paramReg.set(_name, mp);
        }
        const name: string = typeof (_cfg) === "object" ? _cfg["name"] : _cfg;
        const required: boolean = typeof (_cfg ) === "object" ? _cfg["required"] : false; // default value is false
        mp.push({index: _index, type: _type, name, transformer: _transformer, required});
        mp.sort((p, n) => {
            return p.index - n.index;
        });
    }

    public getMethodMeta(_methodName: string) {
        return this.methodMeta.get(_methodName);
    }

    public getMethodParam(_clzMethod: string) {
        const rtn = this.paramReg.get(_clzMethod);
        return rtn ? rtn : this.parent ? this.parent.getMethodParam(_clzMethod) : undefined;
    }

    public setHead(_clzMethod: string, _config?: RPParam): void {
        this.setter(ReqMethodType.Head, _clzMethod, _config);
    }

    public getHead(_url: string): RouterPattern {
        return this.getter(ReqMethodType.Head, _url);
    }

    public setGet(_clzMethod: string, _config?: RPParam): void {
        this.setter(ReqMethodType.Get, _clzMethod, _config);
    }

    public getGet(_url: string): RouterPattern {
        return this.getter(ReqMethodType.Get, _url);
    }

    public setPost(_clzMethod: string, _config?: RPParam): void {
        this.setter(ReqMethodType.Post, _clzMethod, _config);
    }

    public getPost(_url: string): RouterPattern {
        return this.getter(ReqMethodType.Post, _url);
    }

    public setParent(parent: RouterForClz) {
        this.parent = parent;
    }

    public toString(blanks: number): string {
        const rtn = [];
        const ss = new Array(blanks).join(" ");
        this.methodReg.forEach((value, reqType) => {
            value.forEach((routerPattern, url) => {
                const renderStr = [];
                if (routerPattern.render) {
                    if (Array.isArray(routerPattern.render)) {
                        routerPattern.render.forEach((rp) => {
                            renderStr.push(rp.path);
                        });
                    } else {
                        renderStr.push(JSON.stringify(routerPattern.render));
                    }
                }
                rtn.push(`${ss}${ReqMethodType[reqType].toUpperCase()} ${url} => {function:"${routerPattern.clzMethod}"` +
                    (renderStr.length > 0 ? `,render:"${renderStr.join(",")}"}` : "}"));
            });
        });
        return rtn.join("\n");
    }

    private parent: RouterForClz;

    private paramReg: Map<string, MethodParams[]> = new Map<string, MethodParams[]>();

    private methodReg: Map<ReqMethodType, Map<String, RouterPattern>> = new Map<ReqMethodType, Map<String, RouterPattern>>();

    private methodMeta: Map<String, {rpp: RPParam, types: ReqMethodType[]}> = new Map<String, {rpp: RPParam, types: ReqMethodType[]}>();

    private getter(_reqType: ReqMethodType, _url: string) {
        const tg = this.methodReg.get(_reqType);
        if (tg) {
            const rtn = tg.get(_url);
            if (rtn) {
                return rtn;
            }
        }
        return this.parent ? this.parent.getter(_reqType, _url) : undefined;
    }

    private setter(_reqType: ReqMethodType, _clzMethod: string, _config: RPParam) {
        let tg = this.methodReg.get(_reqType);
        if (!tg) {
            tg = new Map<String, RouterPattern>();
            this.methodReg.set(_reqType, tg);
        }
        const rp: RouterPattern = new RouterPattern(this.fnPath, _clzMethod, _config);
        tg.set(rp.urlPattern, rp);
        const treg = this.methodMeta.get(_clzMethod);
        if (treg) {
            treg.types.push(_reqType);
        } else {
            this.methodMeta.set(_clzMethod, {rpp: _config, types: [_reqType]});
        }
    }
}

export declare type RouterMap = {[index: string]: Function};
export declare type RouteCfgAssets = string | {[index: string]: string | {folder: string, cache?: "Etag" | "Cache-Control" | "None", strategy?: string}};
export declare type RouterConfig = {
    renderStart?: string,
    renderEnd?: string,
    gZipThreshold?: number, // GZip threadhold number
    assets?: RouteCfgAssets, // Assets folder path
    errorProcessor?: Function,
};

export class MVCError extends Error {
    private code: number;

    constructor(_msg: string, _code: number = 500) {
        super(_msg);
        this.code = _code;
    }

    public getCode(): number {
        return this.code;
    }
}

export class ResponseWrap {

}

export class RenderWrap {

}
