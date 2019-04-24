import * as path from "path";
import * as fs from "fs";
import { Container } from "@rockerjs/core";
import { Logger } from "@rockerjs/common";
import scandir from "sb-scandir";
import * as ini from "ini";
import { IComponentCanon, AbstractApplication } from "./main";
import { AbstractFilter, AbstractPlugin } from "../web/annotation";
import { pipe, route, plugin, config } from "../web/main";
import { ApplicationException } from "../errors/application.exception";
import { ENV, CONFIG_FILE_ENV, CONTAINER_TAG, APP_TAG, STARTER } from "../const";
const { APPLICATION_TAG, COMPONENT_TAG, PLUGIN_TAG } = CONTAINER_TAG;
const CONFIG_REG = /^app\.(?:(\w+?)\.)?config$/i;
const CONFIG_TABLE = {};
const CURRENT_ENV = process.env.NODE_ENV || ENV.PROD;
// if file has the magic alphabet, the scanner can't find it
const SHADOW_FILE = "/// shadow";
const SHADOW_FILE1 = "///shadow";
const EXCLUDE_DIR = "excludesDir";

function scan(rootPath: string = process.cwd()) {
    let excludesDir = null;
    if (CONFIG_TABLE[CURRENT_ENV] && Array.isArray(CONFIG_TABLE[CURRENT_ENV][EXCLUDE_DIR])) {
        excludesDir = CONFIG_TABLE[CURRENT_ENV][EXCLUDE_DIR];
    }
    return scandir(rootPath, true, function(pth) {
        const stat = fs.statSync(pth),
            extName = path.extname(pth),
            baseName = path.basename(pth),
            content = stat.isDirectory() ? "" : fs.readFileSync(pth, "utf8");
        let isExcludeDir = false;    

        for (let i = 0, len = excludesDir.length; i < len; i++) {
            const it = excludesDir[i];
            if (it && pth.includes(it)) {
                isExcludeDir = true;
                break;
            }
        }
        return !isExcludeDir && baseName !== "node_modules" && (extName === ".js" && (!content.includes(SHADOW_FILE) && !content.includes(SHADOW_FILE1)) || stat.isDirectory());
    });
}

function parseConfigFile(rootPath: string, componentName?: string) {
    return scandir(rootPath, true, function(pth) {
        const stat = fs.statSync(pth),
            baseName = path.basename(pth);
        return baseName !== "node_modules" && (baseName.match(CONFIG_REG) || stat.isDirectory());
    }).then((result) => {
        result.files.forEach((fpath: string) => {
            const baseName = path.basename(fpath),
            matchArray = baseName.match(CONFIG_REG),
            configEnv = matchArray && matchArray[1];
            configEnv ? (CONFIG_TABLE[configEnv] = ini.parse(fs.readFileSync(fpath, "utf-8")))
                : (CONFIG_TABLE[ENV.PROD] = ini.parse(fs.readFileSync(fpath, "utf-8")));
        });
        return CONFIG_TABLE;
    });
}

export async function bootstrap(rootPath: string) {
    try {
        let modules = [];
        const scanErrorFiles = [];
        // 1st step: parse configuration
        await parseConfigFile(rootPath);

        // 2nd step: scan files and load them, but can't find the starter configured in app.config
        await scan(rootPath).then((result) => {
            return result.files.forEach((f: string) => {
                try {
                    require(f);
                } catch (e) {
                    // deps haven't init already, reload them after modules initation
                    scanErrorFiles.push(f);
                    Logger.warn(`scan exception in path ${f}, ${e.message}`);
                }
            });
        });

        // 3th step: init all components and starters
        // 3.1 init starter
        const componentsInitialArray = [], componentNames = [];
        if (CONFIG_TABLE[CURRENT_ENV]) {
            for (const section in CONFIG_TABLE[CURRENT_ENV]) {
                if (CONFIG_TABLE[CURRENT_ENV].hasOwnProperty(section)) {
                    const sectionConfig = CONFIG_TABLE[CURRENT_ENV][section];
                    if (sectionConfig && sectionConfig[STARTER]) {
                        try {
                            require(sectionConfig[STARTER]);
                        } catch (e) {
                            throw new ApplicationException(`${section} starter run error, ${e.message}`, e.stack);
                        }
                    }
                }
            }
        }

        Container.getTypedHashmap().get(COMPONENT_TAG) && Container.getTypedHashmap().get(COMPONENT_TAG).forEach((v, constructor) => {
            const componentName = constructor.name.substring(0, 1).toLowerCase() + constructor.name.substring(1);
            const curretEnvConfig = CONFIG_TABLE[CURRENT_ENV] && CONFIG_TABLE[CURRENT_ENV][componentName];
            const object = Container.getObject<IComponentCanon>(componentName);
            curretEnvConfig[CONFIG_FILE_ENV] = CURRENT_ENV;
            // (constructor as any)._module(curretEnvConfig);
            componentNames.push(componentName);
            componentsInitialArray.push(object.start(curretEnvConfig));
        });

        let initialOutcome = await Promise.all(componentsInitialArray);
        initialOutcome = initialOutcome.map((val, index) => {
            return val ? val : (Container.getObject<IComponentCanon>(componentNames[index]));
        });

        // 4th step: reload error files
        scanErrorFiles.forEach((f) => {
            try {
                require(f);
            } catch (e) {
                throw new ApplicationException(`File ${f}'s dependences can't load normally, ${e.message}`, e.stack);
            }
        });

        modules = Object.keys(require("module")._cache).filter((name) => {
            return name.indexOf("/node_modules") === -1;
        });

        // 5th: web server start
        // 5.1: collect filters
        const filters: Array<AbstractFilter> = [];
        const filtersConfig = {};
        CONFIG_TABLE[CURRENT_ENV] && Object.keys(CONFIG_TABLE[CURRENT_ENV]).map((it) => {
            if (it.indexOf("filter:") !== -1) {
                filtersConfig[it.slice(7)] = CONFIG_TABLE[CURRENT_ENV][it];
            }
        });
        // CONFIG_TABLE[CURRENT_ENV][FILTER_CONFIG_SECTION] && CONFIG_TABLE[CURRENT_ENV][FILTER_CONFIG_SECTION][FILTER_CONFIG_ARRAY];

        // if (!Array.isArray(filtersConfig)) {
        //     throw new ApplicationException(`Filter's config must be an array, like "filters[]=filterName:arg1,arg2"`);
        // }

        Object.keys(filtersConfig).forEach((filterName) => {
            try {
                const filter = Container.getObject<AbstractFilter>(filterName);
                filter.init(filtersConfig[filterName]);
                filters.push(filter);
            } catch (e) {
                throw new ApplicationException(`Filter error duaring its lifetime, ${e.message}`, e.stack);
            }
        });

        // beforeServerStart hook
        if (Container.getTypedHashmap().get(APPLICATION_TAG)) {
            if (Container.getTypedHashmap().get(APPLICATION_TAG).size !== 1) {
                throw new ApplicationException(`Application must have only one entry method`);
            } else {
                const applicationArray = [];
                Container.getTypedHashmap().get(APPLICATION_TAG).forEach((v, clazz) => {
                    applicationArray.push(Container.injectClazzManually(clazz, APPLICATION_TAG).beforeServerStart({
                        config,
                    }, CONFIG_TABLE[CURRENT_ENV] && CONFIG_TABLE[CURRENT_ENV][APP_TAG]));
                });
                await Promise.all(applicationArray);
            }
        } else {
            throw new ApplicationException(`Must have Application annotation`);
        }
        
        // 5.2: mvc runner
        // 5.2.1: amount filters
        filters.forEach((filter) => {
            pipe(filter.doFilter.bind(filter));
        });
        // 5.2.2: parse controller
        const rockerjsHandler = route(modules);
        // 5.2.3: start mvc
        const serverHandler = rockerjsHandler.start({
            port: +(CONFIG_TABLE[CURRENT_ENV][APP_TAG]["port"] || CONFIG_TABLE[CURRENT_ENV]["port"] || 8080),
        });
        // 5.2.4: add render plugins
        Container.getTypedHashmap().get(PLUGIN_TAG) && Container.getTypedHashmap().get(PLUGIN_TAG).forEach((v, clazz) => {
            const pl: AbstractPlugin = Container.injectClazzManually(clazz, PLUGIN_TAG);
            const clazzName = clazz.name;
            const pluginName = clazzName.substring(0, 1).toLowerCase() + clazzName.substring(1);
            // 调用plugin
            plugin(pl.do(CONFIG_TABLE[CURRENT_ENV] && CONFIG_TABLE[CURRENT_ENV][pluginName]));
        });

        // 6th: start engine
        if (Container.getTypedHashmap().get(APPLICATION_TAG).size !== 1) {
            throw new ApplicationException(`Application must have only one entry method`);
        } else {
            const applicationArray = [];
            Container.getTypedHashmap().get(APPLICATION_TAG).forEach((v, clazz) => {
                applicationArray.push((clazz as any).main(CONFIG_TABLE[CURRENT_ENV] && CONFIG_TABLE[CURRENT_ENV][APP_TAG]));
            });
            await Promise.all(applicationArray);
        }
    } catch (e) {
        throw e;
    }
}
