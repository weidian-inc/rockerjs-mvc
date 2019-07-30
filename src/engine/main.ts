import { Container } from "@rockerjs/core";
import { ApplicationException } from "../errors/application.exception";
import { ComponentException } from "../errors/component.exception";
import { CONTAINER_TAG } from "../const";
import { ServerFacade } from "../web/type";
import * as Util from "../util";
const { APPLICATION_TAG, COMPONENT_TAG } = CONTAINER_TAG;
const ComponentRelationContainer: Map<FunctionConstructor, object> = new Map();

export abstract class AbstractComponent {
    public static Module: any;
    // private static _moduleObject: any;
    // public static _module(config: any): any {
    //     if (config.driver.match(PATH_REG)) {
    //         this._moduleObject = require(path.join(process.cwd(), `${config.driver}`));
    //     } else {
    //         this._moduleObject = require(`${config.driver}`);
    //     }
    // }
    // public static module<T>(): T {
    //     return this._moduleObject;
    // }

    public abstract start(config: any, appConfig?: any): Promise<any> | any;
}

export interface IComponentCanon {
    name: string;
    status: "on" | "pending" | "off";
    start: (args: any, appConfig?: any) => Promise<any>;
    export: () => object;
}

/**
 * @description the factory method of decorator, put the Class's instance into the container
 * @param args decorator's params
 * @returns void | any
 */
export function Component(...args: any[]): ClassDecorator | any {
    const fn: ClassDecorator = function(target: Function) {
        // define class module 
        if (target !== undefined) {
            const clazz = target as FunctionConstructor; // target is class constructor
            Container.provides([ COMPONENT_TAG, clazz, function() {
                try {
                    const component = new (class implements IComponentCanon {
                        public name: string;
                        public status: "on" | "pending" | "off" = "off";
                        public dependences = [];
                        private _export: AbstractComponent;

                        constructor(name: string) {
                            this.name = name;
                            try {
                                this._export = (new (clazz)(...args)) as any;
                                // set prototype
                                // const originProto = (this as any).__proto__;
                                // (this as any).__proto__ = this._export;
                                // (this as any).__proto__.constructor = originProto.constructor;
                                // (this as any).__proto__.__proto__.__proto__ = originProto;
                                this.status = "pending";
                                ComponentRelationContainer.set(clazz, this);
                            } catch (e) {
                                this.status = "off";
                                e.target = this;
                                ComponentRelationContainer.set(clazz, e);
                            }
                        }
    
                        // args should be injected from config file 
                        public start(config: any, appConfig: any): Promise<any> {
                            if (this._export && typeof this._export.start === "function") {
                                try {
                                    const sret = this._export.start(config, appConfig);
                                    return Util.isPromise(sret) ? sret.then((result) => {
                                        this.status = "on";
                                        return result ? result : this;
                                    }).catch((err) => {
                                        this.status = "off";
                                        throw new ComponentException(err.message, err.stack);
                                    }) : (this.status = "on", Promise.resolve(sret ? sret : this));
                                } catch (err) {
                                    this.status = "off";
                                    throw new ComponentException(err.message, err.stack);
                                }
                            } else {
                                // do not have start
                                this.status = "on";
                                return Promise.resolve(this);
                            } 
                        }

                        public export() {
                            return this._export;
                        } 
                    })(clazz.name);

                    const clazzName = clazz.name;
                    Container.setObject(clazzName.substring(0, 1).toLowerCase() + clazzName.substring(1), component);
                    return component;
                } catch (e) {
                    throw new ComponentException(`Module factory error, ${e.message}`);
                }
            }]);

            args.unshift(COMPONENT_TAG);
            Container.injectClazzManually(clazz, ...args);
        }
    };
    return fn.apply(null, args);
}

export abstract class AbstractApplication {
    public static async main<T extends AbstractApplication>(this: new (someVar: any) => T, config: any): Promise<void> { 
        throw new ApplicationException(`Application must override the static method "main"`);
    }

    public abstract async beforeServerStart(server: ServerFacade, config: any): Promise<void>;
}

export function Application(...args: any[]): ClassDecorator | any {
    return (function(target: Function) {
        // define class module 
        if (target !== undefined) {
            const clazz = target as FunctionConstructor; // target is class constructor
            Container.provides([APPLICATION_TAG, clazz, function() {
                return new clazz();
            }]);
            args.unshift(APPLICATION_TAG);
            Container.injectClazzManually(clazz, ...args);
        }
    }).apply(this, args);
}
