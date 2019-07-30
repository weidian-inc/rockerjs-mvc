import { Container } from "@rockerjs/core";
import * as Application from "koa";
import { CONTAINER_TAG, CONTROLLER } from "../const";
import * as _Types from "./type";
import { Types } from "./main";
const { ReqMethodParamType } = _Types;

/**
 * Router pattern bindings
 * @type Map<Function, _Types.RouterForClz>
 * Function:RouterClass
 */
export const routerPtnBindings: Map<Function, _Types.RouterForClz> = new Map<Function, _Types.RouterForClz>();

export const routerPathBindings: Map<Function, string> = new Map<Function, string>();

export function Filter(...args: any[]): ClassDecorator | any {
    return (function(target: Function) {
        // define class module 
        if (target !== undefined) {
            const clazz = target as FunctionConstructor; // target is class constructor
            Container.provides([CONTAINER_TAG.FILTER_TAG, clazz, function() {
                const clazzName = clazz.name;
                const filter = new clazz(...args);
                Container.setObject(clazzName.substring(0, 1).toLowerCase() + clazzName.substring(1), filter);
            }]);

            args.unshift(CONTAINER_TAG.FILTER_TAG);
            Container.injectClazzManually(clazz, ...args);
        }
    }).apply(this, args);
}

export abstract class AbstractFilter {
    public abstract init(args: any, appConfig?: any): void;
    public abstract async doFilter(context: Application.Context, next): Promise<void>;
    public abstract destroy(): void;
}

export function Plugin(...args: any[]): ClassDecorator | any {
    return (function(target: Function) {
        // define class module 
        if (target !== undefined) {
            const clazz = target as FunctionConstructor; // target is class constructor
            Container.provides([CONTAINER_TAG.PLUGIN_TAG, clazz, function() {
                const clazzName = clazz.name;
                const plugin = new clazz(...args);
                return plugin;
            }]);

            args.unshift(CONTAINER_TAG.PLUGIN_TAG);
            Container.injectClazzManually(clazz, ...args);
        }
    }).apply(this, args);
}

export abstract class AbstractPlugin {
    public abstract do(config: any): (input: Types.Pluginput) => void;
}

export function Controller(...args: any[]): ClassDecorator | any {
    return function(target: Function) {
        // define class module 
        if (target !== undefined) {
            const clazz = target as FunctionConstructor; // target is class constructor
            Container.provides([CONTAINER_TAG.CONTROLLER_TAG, clazz, function() {
                const clazzName = clazz.name;
                const composeMap = new Map();
                composeMap.set(CONTROLLER.CLASS, clazz);
                composeMap.set(CONTROLLER.REQUEST_MAPPING, args && args.length && args[1] || `/${clazzName}`);
                Container.setObject(clazzName.substring(0, 1).toLowerCase() + clazzName.substring(1), composeMap);
            }]);

            args.unshift(CONTAINER_TAG.CONTROLLER_TAG);
            Container.injectClazzManually(clazz, ...args);
        }
    };
}

/**
 * The param"s decorator for Request object of koa
 * @param {object} target
 * @param {string} methodName
 * @param {number} index
 * @constructor
 */
export function Request(target: object, methodName: string, index: number): void {
    const rfc: _Types.RouterForClz = getRouterForClz(target);
    rfc.regMethodParam(methodName, index, ReqMethodParamType.Request, {required: true}, (v) => {
        return v;
    });
}

export function Response(target: object, methodName: string, index: number): void {
    const rfc: _Types.RouterForClz = getRouterForClz(target);
    rfc.regMethodParam(methodName, index, ReqMethodParamType.Response, { required: true }, (v) => {
        return v;
    });
}

export function Param(_cfg: _Types.RouterParamType): Function {
    return function(target: Function, paramName: string, index: number) { // Use @Get(string|{url:string,render:string})
        const rfc: _Types.RouterForClz = getRouterForClz(target);
        let dt = Reflect.getMetadata("design:paramtypes", target, paramName);
        if (!dt) {
            dt = Reflect.getMetadata("design:paramtypes", target.constructor, paramName);
        }
        if (!dt) {
            throw new Error("Reflect error occured.");
        }
        rfc.regMethodParam(paramName, index, ReqMethodParamType.Normal, _cfg, (v) => {
            if ( v === undefined || v === null) {
                return v;
            }
            const tfn = dt[index];
            if (tfn.name.toUpperCase() === "OBJECT" || tfn.name.toUpperCase() === "BOOLEAN") {
                return typeof (v) === "string" ? (new Function("", `return ${v}`))() : v; // Support ill-formed json object
            } else {
                return tfn(v);
            }
        });
    };
}

export function Head(...args: (_Types.RPParam)[]): Function|any {
    return decoratorMethod("head", args);
}

export function Get(...args: (_Types.RPParam)[]): Function|any {
    return decoratorMethod("get", args);
}

export function Post(...args: (_Types.RPParam)[]): Function|any {
    return decoratorMethod("post", args);
}

// --------------------------------------------------------------------------------------------

function decoratorMethod(method: string, args): Function|any {
    const md = method.charAt(0).toUpperCase() + method.substring(1);
    if (args.length === 1) { // @Get(string|{url:string,render:string})
        const cfg: any = args[0];
        return function(target: Function, methodName: string, desc: object) {
            const rfc: _Types.RouterForClz = getRouterForClz(target);
            rfc[`set${md}`](methodName, cfg);
        };
    } else
    /* istanbul ignore if */
    if (args.length === 3) { // @Get
        const rfc: _Types.RouterForClz = getRouterForClz(args[0]);
        const meta = rfc.getMethodMeta(args[1] as string);
        if (meta) {
            rfc[`set${md}`](args[1] as string, meta.rpp);
        } else {
            throw new Error(`${md} decorator's param error.`);
        }
    }
}

function getRouterForClz(target) {
    const fn = target.constructor;
    return routerPtnBindings.get(fn) || (routerPtnBindings.set(fn, new _Types.RouterForClz(() => {
        return routerPathBindings.get(fn);
    })).get(fn));
}
