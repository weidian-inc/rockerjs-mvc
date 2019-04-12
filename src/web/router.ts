import Application = require("koa");
import { Logger } from "@rockerjs/common";
import * as Types from "./type";
let routerReg;
let routerPtnBindings: Map<Function, Types.RouterForClz>;
import * as mime from "mime";
import * as FS from "fs";
import * as PATH from "path";

import * as Util from "../util";
import { Router } from "./config";
import { RouterMap, RouterConfig } from "./type";
import { Stream } from "stream";
import { DownloadResp, RedirectResp, RenderResp } from "./main";

const assetsPt = /\.(js|map|css|less|png|jpg|jpeg|gif|bmp|ico|webp|html|htm|eot|svg|ttf|woff|mp4|mp3)$/i;

export default function(_routerMap, _routerPtnBindings: Map<Function, Types.RouterForClz>) {
    routerPtnBindings = _routerPtnBindings;
    routerReg = _routerMap;
    const urlSearcher = searchPtn(routerReg), assets = proAssets(),
        fnAssets = function(url, context: Application.Context) {
            if (assetsPt.test(url)) { // For assets
                assets(url, context);
                return true;
            }
        }, fnRouter = async function(url, context: Application.Context, bt: number) {
            const ptUrl = urlSearcher(url); // The url matched
            if (ptUrl) {
                const rw: FunctionConstructor = routerReg.all[ptUrl] as FunctionConstructor;
                if (rw) {
                    const rfc: Types.RouterForClz = routerPtnBindings.get(rw);
                    if (rfc) { // have decorators for router
                        await invoke(context, ptUrl, url, rfc, rw);
                    }
                }
                Logger.info(`[Rocker-mvc]Request ${context.request.url} costed ${new Date().getTime() - bt} ms.`);
                return true;
            }
        };
    return async function(context: Application.Context, next) {
        let url: string = context.request.url;
        if (Util.isEmpty(url)) {
            throw new Types.MVCError("No url found", 404);
        }

        const bt = new Date().getTime();
        url = url.replace(/\?[\s\S]*/ig, "");

        if (Router.assets) {
            if (!fnAssets(url, context)) {
                if (!await fnRouter(url, context, bt)) {
                    throw new Types.MVCError(`The request url(${url}) not found.`, 404);
                }
            }
        } else {
            if (!await fnRouter(url, context, bt)) {
                if (!fnAssets(url, context)) {
                    throw new Types.MVCError(`The request url(${url}) not found.`, 404);
                }
            }
        }
    };
}

// Assets
function proAssets() {
    const EtagSet = new Set();
    return function(url: string, context) {
        let etag = context.headers["if-none-match"];
        if (etag && EtagSet.has(etag)) {
            context.response.status = 304;
            return;
        }

        if (!Router.assets) {
            if (!/^\/favicon.ico$/i.test(url)) { // Ignore /favicon.ico
                throw new Types.MVCError("No assets configuration in route.", 404);
            } else {
                return;
            }
        }

        let folderPath, cacheStrategy: { cache: "Etag" | "Cache-Control" , strategy?: string};
        if (typeof (Router.assets) === "string") {
            folderPath = Router.assets;
        } else if (typeof (Router.assets) === "object") {
            for (const urlPre in Router.assets) {
                const to: any = Router.assets[urlPre];
                if (url.startsWith(urlPre)) {
                    url = url.substring(urlPre.length);
                    if (url.trim() === "") {
                        throw new Types.MVCError("Not found.", 404);
                    }
                    if (typeof (to) === "object") {
                        cacheStrategy = to;
                        folderPath = to.folder;
                    } else {
                        folderPath = to;
                    }
                }
            }
        }

        cacheStrategy = Object.assign({cache: "Etag" }, cacheStrategy);

        if (folderPath) {
            const absPath = PATH.join(folderPath, url);
            if (!absPath.startsWith(folderPath)) {
                throw new Error("Access error.");
            }

            const stat = FS.statSync(absPath);
            if (stat.isFile()) {
                try {
                    const mt = mime.getType(PATH.basename(absPath));

                    context.response.status = 200;
                    context.response.set("Content-Type", mt);
                    if (cacheStrategy.cache === "Etag") {
                        etag = url + "-" + stat.mtime.getTime().toString(16);
                        EtagSet.add(etag);
                        context.response.set("ETag", etag);
                    } else if (cacheStrategy.cache === "Cache-Control") {
                        context.response.set("Cache-Control", cacheStrategy.strategy || "public, max-age=604800"); // Default value = a week
                    }

                    context.body = FS.createReadStream(absPath);
                } catch (ex) {
                    if (!/^\/favicon.ico$/i.test(url)) { // Ignore /favicon.ico
                        throw new Types.MVCError(`The request url(${url}) error.`, 500);
                    } else {
                        throw ex;
                    }
                }
                return;
            }
        }
        throw new Types.MVCError("Not found.", 404);
    };
}

// Url pattern closure
function searchPtn(_routerMap: RouterConfig & {all: RouterMap}) {
    let urlPattern: RegExp;
    let ts: string = "";
    for (const key in _routerMap.all) {
        ts += "|^" + key + "$";
    }

    urlPattern = new RegExp(ts.substring(1), "ig");

    function recur(_url: string): string {
        if (urlPattern) {
            const url = _url === "" ? "/" : _url;
            let ptAry: RegExpExecArray;
            try {
                ptAry = urlPattern.exec(url);
            } finally {
                urlPattern.lastIndex = 0;
            }
            if (!ptAry) {
                const ary: string[] = url.split("/");
                ary.pop();
                if (!ary.length) {
                    return;
                }
                const nts = ary.join("/");
                return nts === _url ? undefined : recur(nts);
            } else {
                return ptAry[0];
            }
        }
    }

    return recur;
}

/**
 * Invoke a function from router class
 * @param {Application.Context} _ctx
 * @param {string} _urlRoot
 * @param {string} _urlFull
 * @param {RouterForClz} routerForClz
 * @param {FunctionConstructor} fn
 * @returns {Promise<void>}
 */
async function invoke(_ctx: Application.Context,
                      _urlRoot: string,
                      _urlFull: string,
                      routerForClz: Types.RouterForClz,
                      fn: FunctionConstructor) {
    let urlSub = _urlFull.substring(_urlRoot.length);
    urlSub = (urlSub.startsWith("/") ? "" : "/") + urlSub;
    let pattern: Types.RouterPattern;
    let args: any;

    if (_ctx.is("multipart")) {
        pattern = routerForClz.getPost(urlSub);
        args = ((_ctx.request) as any).body || {};
    } else if (_ctx.request.method === "POST") {
        pattern = routerForClz.getPost(urlSub);
        args = await getPostArgs(_ctx);
    } else if (_ctx.request.method === "GET") {
        pattern = routerForClz.getGet(urlSub);
        args = _ctx.request.query;
    } else if (_ctx.request.method === "HEAD") {
        pattern = routerForClz.getHead(urlSub);
        args = _ctx.request.query;
    }

    if (pattern) {
        let instance;
        try {
            instance = new (fn as FunctionConstructor)(); // new instance
        } catch (ex) {
            Logger.error(`New class\n\n${fn}\nerror.`);
            throw ex;
        }
        const paramAry = [];
        const paramDescAry = routerForClz.getMethodParam(pattern.clzMethod);
        if (paramDescAry) {
            paramDescAry.forEach((_desc) => {
                if (_desc.type === Types.ReqMethodParamType.Normal) {
                    if (_desc.required && !args[_desc.name]) {
                        throw new Types.MVCError(`The request param[${_desc.name}] not found.`, 500);
                    }
                    paramAry.push(_desc.transformer(args[_desc.name]));
                } else if (_desc.type === Types.ReqMethodParamType.Request) {
                    paramAry.push(_ctx.request);
                } else if (_desc.type === Types.ReqMethodParamType.Response) {
                    paramAry.push(_ctx.response);
                }
            });
        }

        const rtn = await instance[pattern.clzMethod].apply(instance, paramAry);
        if (rtn !== undefined) {
            if (rtn instanceof Stream) { // Return an Stream object
                _ctx.response.status = 200;
                _ctx.body = rtn;
                return;
            } else if (rtn instanceof RedirectResp) { // For redirect
                _ctx.response.status = rtn.code;
                _ctx.redirect(rtn.url);
                return;
            } else if (rtn instanceof DownloadResp) { // For download
                const dr: DownloadResp = rtn;
                _ctx.response.status = 200;
                _ctx.response.attachment(dr.name); // Download file name
                _ctx.body = dr.stream;
                return;
            } else if (typeof (rtn) === "function") {
                throw new Types.MVCError(`Object or raw value expected but got \n       ${rtn}`);
            }
        }

        if (pattern.render) { // render by template
            if (rtn !== undefined && typeof (rtn) !== "object") {
                throw new Types.MVCError(`Object type expected but got \n       ${rtn}`);
            }

            // Multi view
            /* istanbul ignore if */
            if (rtn instanceof RenderResp) {
                if (typeof pattern.render !== "object") {
                    throw new Types.MVCError(`The request url(${_urlFull}, full path: ${_ctx.url}, method: ${_ctx.method}), the render in decorator must be an object.`, 500);
                }
                const rd = pattern.render[rtn.name];
                if (!rd) {
                    throw new Types.MVCError(`The request url(${_urlFull}, full path: ${_ctx.url}, method: ${_ctx.method}), render(name:${rtn.name}) not found.`, 404);
                }
                _ctx.response.status = 200;
                _ctx.response.set("Content-Type", "text/html;charset=utf-8");
                _ctx.response.set("Transfer-Encoding", "chunked");

                rd.forEach(function(_rd) {
                    const html = renderFn(routerForClz, _rd, rtn.model);
                    _ctx.res.write(html);
                });
                _ctx.res.end();
            } else {
                _ctx.response.status = 200;
                _ctx.response.set("Content-Type", "text/html;charset=utf-8");

                if (Array.isArray(pattern.render)) { // string[] for Bigpipe
                    _ctx.response.set("Transfer-Encoding", "chunked");
                    pattern.render.forEach(function(_rd) {
                        const html = renderFn(routerForClz, _rd, rtn);
                        _ctx.res.write(html);
                    });
                    _ctx.res.end();
                } else {
                    throw new Types.MVCError(`The request url(${_urlFull}, full path: ${_ctx.url}, method: ${_ctx.method}), render format error.`, 500);
                }
            }
        } else {
            _ctx.response.status = 200;
            _ctx.response.set("Content-Type", "application/json;charset=utf-8");
            _ctx.body = typeof (rtn) === "object" ? JSON.stringify(rtn) : rtn;
            // _ctx.res.end();
        }
    } else {
        throw new Types.MVCError(`The request url(${_urlFull}, full path: ${_ctx.url}, method: ${_ctx.method}) not found.`, 404);
    }
}

function renderFn(routerForClz: Types.RouterForClz,
                  _render: { path: string, compile: Function },
                  _model: any) {
    try {
        const compiler: Function = _render.compile(); // Get template compiler
        return compiler(_model || {});
    } catch (ex) {
        throw new Types.MVCError(ex);
    }
}

function getPostArgs(context: Application.Context) {
    return new Promise((resolve, reject) => {
        let pdata = "";
        context.req.addListener("data", (postchunk) => {
            pdata += postchunk;
        });
        context.req.addListener("end", () => {
            let reqArgs;
            if (pdata !== "") {
                try {
                    // 针对urlencoded做解析
                    if (pdata.trim().startsWith("{")) {
                        reqArgs = (new Function("", `return ${pdata}`))();
                    } else {
                        const pary = pdata.split("&");
                        if (pary && pary.length > 0) {
                            reqArgs = {};
                            pary.forEach(function(_p) {
                                let tary = _p.split("=");
                                if (context.get("content-type").indexOf("application/x-www-form-urlencoded") !== -1) {
                                    tary = tary.map( (d) => {
                                        d = d.replace(/\+/g, " ");
                                        d = decodeURIComponent(d);
                                        return d;
                                    });
                                }
                                if (tary && tary.length === 2) {
                                    reqArgs[tary[0].trim()] = tary[1];
                                }
                            });
                        }
                    }
                } catch (e) {
                    reject(e);
                }
            }
            resolve(reqArgs);
        });
    });
}
