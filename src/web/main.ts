import * as util from "util";
import { Stream } from "stream";
import { Container } from "@rockerjs/core";
import { init, Logger, _Tracelocal } from "@rockerjs/common";
import * as co from "co";
import * as Application from "koa";
import * as compress from "koa-compress";
import "zone.js";
import { CONTAINER_TAG, CONTROLLER } from "../const";
import { FilterException } from "../errors/filter.exception";
import midRouter from "./router";
import * as Util from "../util";
import * as _Types from "./type";
import { ReqMethodParamType, RouterConfig, RouterMap, MVCError, RenderWrap } from "./type";
import { Start, Router } from "./config";
import { routerPtnBindings, routerPathBindings } from "./annotation";

interface IConfigParam {
    port?: number;
    gZipThreshold?: number;
}

const routerReg: RouterConfig & {all: RouterMap} = {all: {}};

export class RedirectResp extends _Types.ResponseWrap {

    private _url: string;
    /**
     * Response header's code,301\302(default)
     */
    private _code: 302|301 = 302;

    constructor(url: string) {
        super();
        this._url = url;
    }

    get url() {
        return this._url;
    }

    get code() {
        return this._code;
    }

    set code(code: 302|301) {
        this._code = code;
    }
}

export class DownloadResp extends _Types.ResponseWrap {
    private _stream: Stream;
    private _name: string;

    constructor(name: string, stream: Stream) {
        super();
        this._name = name;
        this._stream = stream;
    }

    get name() {
        return this._name;
    }

    get stream() {
        return this._stream;
    }
}

/**
 * Render for return
 */
export class RenderResp extends RenderWrap {
    private _name: string;
    private _model: object;

    /**
     * Constructor
     * @param name The key in render description of
     * @param model
     */
    constructor(name: string, model: object) {
        super();
        this._name = name;
        this._model = model;
    }

    get name(): string {
        return this._name;
    }

    get model(): object {
        return this._model;
    }
}

// --------------------------------------------------------------------------------------------
const koaMidAry: Application.Middleware[] = [];

export function pipe(midware: Application.Middleware) {
    if (!midware) {
        throw new FilterException("The midware for pipe should be a Promise or Generator function");
    }
    koaMidAry.push(midware);
    return {
        route,
        pipe,
        start,
    };
}

export function config(config: RouterConfig) {
    Router.assets = config.assets;
    Router.gZipThreshold = config.gZipThreshold || Router.gZipThreshold; // Default value is Router.gZipThreshold
    Router.errorProcessor = config.errorProcessor;

    return Object.assign(route, { pipe, start});
}

export function route(modules: any[])
    : {
    pipe: Function,
    start: Function,
    (routerMap: _Types.RouterMap | RouterConfig): {
        pipe: Function,
        start: Function,
    },
} {
    const routerMap = {};
    // set controller
    Container.getTypedHashmap().get(CONTAINER_TAG.CONTROLLER_TAG).forEach((v, constructor) => {
        const clazzName = constructor.name.substring(0, 1).toLowerCase() + constructor.name.substring(1);
        const md = getModule(modules, constructor);
        if (!md) {
            throw new Error(`No file for Controller ${clazzName} defined.`);
        }

        const requestMapping = Container.getObject<Map<string, any>>(clazzName).get(CONTROLLER.REQUEST_MAPPING);
        routerPathBindings.set(constructor, md["filename"]);
        routerMap[requestMapping] = constructor;
    });
    routerReg["all"] = routerMap as any;

    // Merge all
    routerPtnBindings.forEach(function(clzReg, fna) {
        routerPathBindings.forEach(function(fnPath, fnb) {
            // Notice,here may be an error,if more than one parent inherit here
            /* istanbul ignore if */
            if (fna.isPrototypeOf(fnb)) {
                const rtc: _Types.RouterForClz = routerPtnBindings.get(fnb);
                if (rtc) {
                    rtc.setParent(clzReg); // Process inherit
                } else {
                    routerPtnBindings.set(fnb, clzReg);
                }
                routerPtnBindings.delete(fna);
                routerPathBindings.set(fna, routerPathBindings.get(fnb));
            }
        });
    });

    const rn: any = {
        pipe,
        start,
    };
    return rn;
}

const pluginAry: { (input: Types.Pluginput): void }[] = [];

/**
 * Startup MVC container
 * @param {object}  Configuration object
 */
function start(config: IConfigParam = {
    port: Start.port,
}): { plugin: Function, server: Application} {
    if (typeof config["port"] !== "number") {
        throw new _Types.MVCError("\n[Rocker-mvc]Start server error, server port expect for start config.\n");
    }
    Start.port = config.port;

    // Router middleware
    const rfn: Function = midRouter(routerReg, routerPtnBindings);

    // Compress middleware
    const cfn: Function = compress({threshold: Router.gZipThreshold});

    koaMidAry.push(async function(context: Application.Context, next) {
        await rfn(context, next);
        await cfn(context, next); // GZip
    });

    let server = null;

    setImmediate(() => {
        const ss = new Array(160).join("-");
        Logger.info(`${ss}`);
        Logger.info(`[Rocker-mvc]Server(${Util.getLocalIp()}) starting...`);

        // Startup plugins
        if (pluginAry.length > 0) {
            const ref: Types.Pluginput = new Map();
            routerPtnBindings.forEach((v, k) => {
                const tv = new Map();
                ref.set(k, tv);
                v["methodReg"].forEach((mr) => {
                    mr.forEach((rp) => {
                        tv.set(rp.urlPattern, rp);
                    });
                });
            });

            pluginAry.forEach((pl) => {
                Logger.info(`[Rocker-mvc]Starting plugin ${pl}...`);
                pl(ref);
            });
        }

        try {
            // Startup koa
            const koa: Application = new Application();
            server = koa;
            if (koaMidAry.length > 0) {
                koaMidAry.forEach((mid, index) => {
                    koa.use(async function(context: Application.Context, next) {
                        if (index === 0) {
                            const zone = Zone.current.fork({
                                name: "koa-context",
                                properties: {
                                    context,
                                    store: {}, // Cache {key,value} for an request trace
                                },
                            });
                            context["_zone"] = zone;
                        }
                        await new Promise((resolve, reject) => {
                            context["_zone"].run(async function() {
                                try {
                                    if (Util.isGeneratorFunction(mid) || Util.isGenerator(mid)) {
                                        await co(mid.call(context, next));
                                    } else {
                                        await mid(context, next);
                                    }
                                    resolve();
                                } catch (ex) {
                                    reject(ex);
                                }
                            });
                        });
                    });
                });
            }

            // Init global Tracelocal
            init({
                Tracelocal() {
                    return new class extends _Tracelocal {
                        get id() {
                            try {
                                return Zone.current.get("context").request.header[_Types.TRACE_ID_KEY_IN_HEADER];
                            } catch (ex) {
                                throw new _Types.MVCError(`Get trace id error\n${ex}`, 500);
                            }
                        }

                        public get(key: string) {
                            const r = Zone.current.get("store")[key];
                            return r !== undefined ? r : Zone.current.get("context")[key];
                        }

                        public set(key: string, value: any): void {
                            Zone.current.get("store")[key] = value;
                        }
                    }();
                },
            });
            Logger.info(`\n[Rocker-mvc]Init Tracelocal completed.`);

            koa.context.onerror = onKoaErr;
            koa.listen(config.port, "0.0.0.0");

            Logger.info(bootstrapMsg());

            Logger.info(`\n[Rocker-mvc]Server(${Util.getLocalIp()}) start completed,listening on port ${config.port}...`);
            Logger.info(`${ss}`);

            process.on("uncaughtException", function(err) {
                Logger.error(err);
            });

            process.on("unhandledRejection", function(reason, p) {
                Logger.error(`unhandled rejection: ${p} reason: ${reason}`);
            });
        } catch (ex) {
            Logger.error("[Rocker-mvc]Start server ${address} error.\n");
            Logger.error(ex);
            Logger.info(`${ss}`);
            throw ex;
        }
    });

    return {
        plugin,
        server,
    };
}

export function plugin(pluginFn: {(input: Types.Pluginput): void}): {plugin: Function} {
    if (util.isFunction(pluginFn)) {
        pluginAry.push(pluginFn);
    } else {
        throw new _Types.MVCError(`The Plugin must be a function.`);
    }
    return {
        plugin,
    };
}

export namespace Const {
    export const Assets: string = "Assets";
}

export namespace Types {
    export type Pluginput = Map<Function,
        Map<String,
            {
                render:
                    {
                        path: string, // Template absolute path
                        factory: Function, // Factory function
                    }[];
            }>
        >;
}

// --------------------------------------------------------------------------------------------

function bootstrapMsg() {
    const startMsg = [];
    if (Router.errorProcessor) {
        startMsg.push(`  Router errorProcessor:`);
        startMsg.push(`    ${Router.errorProcessor}\n`);
    }

    if (Router.assets) {
        startMsg.push(`  Router assets:`);
        startMsg.push(`    ${JSON.stringify(Router.assets)}\n`);
    }

    if (routerReg.all) {
        startMsg.push(`  Router mappings:`);
        const all = routerReg.all;
        for (const rootUrl in all) {
            const tv = routerPtnBindings.get(all[rootUrl]);
            if (tv) {
                startMsg.push(`    ${rootUrl} => "${tv.fnPath()}"`);
                startMsg.push(`${tv.toString(8)}`);
            } else {
                startMsg.push(`    ${rootUrl}:None`);
            }
        }
    }
    return startMsg.join("\n");
}

function onKoaErr(err: any) {
    if (!err) {
        return;
    }
    const th = this;
    this["_zone"].run(function() {
        // wrap non-error object
        if (!(err instanceof Error)) {
            const newError: any = new Error(`non-error thrown: ${err}`);
            // err maybe an object, try to copy the name, message and stack to the new error instance
            if (err) {
                if (err.name) {
                    newError.name = err.name;
                }
                if (err.message) {
                    newError.message = err.message;
                }
                if (err.stack) {
                    newError.stack = err.stack;
                }
                if (err.status) {
                    newError.status = err.status;
                }
                if (err.headers) {
                    newError.headers = err.headers;
                }
            }
            err = newError;
        }

        let errCode = typeof err["getCode"] === "function" ? err["getCode"]() : 500;
        let content: string;
        if (Router.errorProcessor) {
            content = Router.errorProcessor(err);
            if (typeof (content) === "boolean" && !content) {
                return;
            }
            errCode = 200; // status code is 200 when errorProcessor exist
        }

        th.response.status = errCode;
        if (content !== undefined && content !== null) {
            let data: string;
            if (typeof (content) === "object") {
                th.set("Content-Type", "application/json;charset=utf-8");
                data = JSON.stringify(content);
            } else {
                th.set("Content-Type", "text/html");
                data = content;
            }
            th.res.end(data);
        } else {
            th.set("Content-Type", "text/html");
            th.res.end("<h1>" + errCode + "</h1>" + "<div>" + err + "</div>");
        }
        setTimeout(function() {
            if (err.stack) {
                Logger.error(err.stack);
            } else if (err.message) {
                Logger.error(err.message);
            } else {
                Logger.error("Unknown error occurred.");
            }
        });
    });
}

/**
 * Get it"s defined module,Notice! here may be an error
 * @param md
 * @param {Function} clz
 * @returns [module,subClass]
 */
function getModule(modules, clz: Function): Promise<any> {
    if (Array.isArray(modules)) {
        for (let i = 0, len = modules.length; i < len; i++) {
            const md = require("module")._cache[modules[i]];
            const _exports = md.exports;
            for (const k in _exports) {
                if (_exports.hasOwnProperty(k)) {
                    if (clz === _exports[k]) {
                        return md;
                    }
                }
            }
            if (clz === _exports) {
                return md;
            }
        }
    } 
    return null;
}
