import { Container, Inject } from "@rockerjs/core";
import { bootstrap } from "./src/engine";
import { AbstractComponent, Component, AbstractApplication, Application } from "./src/engine/main";
import { Filter, AbstractFilter, Controller, Request, Response, Param, Head, Get, Post } from "./src/web/annotation";
import { RedirectResp, DownloadResp } from "./src/web/main";
import { NODE_STARTER } from "./src/const";

// auto start if doesn't use rockerjs command tool
if (process.env["NODE_STARTER"] !== NODE_STARTER) {
    (async () => {
        await bootstrap(process.cwd());
    })();
}

export { bootstrap, Inject, Container, AbstractComponent, Component, AbstractApplication, Application,
    Filter, AbstractFilter, Controller, Request, Response, Param, Head, Get, Post, RedirectResp, DownloadResp };
