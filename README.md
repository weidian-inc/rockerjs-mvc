# Rockerjs MVC
[![Build Status](https://travis-ci.org/weidian-inc/rockerjs-core.svg?branch=dev)](https://travis-ci.org/weidian-inc/rockerjs-core)
[![Coverage Status](https://coveralls.io/repos/github/weidian-inc/rockerjs-core/badge.svg?branch=dev)](https://coveralls.io/github/weidian-inc/rockerjs-core?branch=dev)
[![npm package](https://img.shields.io/npm/v/@rockerjs/core.svg)](https://www.npmjs.org/package/@rockerjs/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

- [项目主页](https://rockerjs.weidian.com/compass/mvc.html)
- [实例尝鲜](https://github.com/weidian-inc/rockerjs-demo)

## 简介

Rockerjs-MVC是一套基于配置、具有轻量级容器特性且集成了链路追踪功能的Node.js Web应用框架。

Rockerjs-MVC的容器特性可极致简化你的代码，帮助你快速构建高效、可扩展的应用程序。它采用DI（Dependency Inject）和OOP（Object Oriented Programming）的理念，遵循 **“配置大于约定”** 的规范，同时提供 **Starter机制** 实现“模块粒度下配置与约定的融合” ，使用TypeScript强类型语言构建你的应用。

> Rockerjs-MVC的所有功能都是基于一个遵循**ini配置规范**的 "app.${env}.config" 文件来实现的，可提供四种不同环境的配置文件：dev、daily、pre、prod

> 轻量级容器特性意味着Rockerjs-MVC可管理所有注解标识类的实例化对象，并管理其生命周期、对象间的依赖关系；当使用这些对象时可通过注解直接引用，无需手动实例化或建立对象间依赖。

> Starter机制提供某些模块约定俗成的配置并自动初始化，无需开发者在程序中显式操作。当默认配置无法满足时，可通过配置文件配置该Starter相关参数。Starter机制采用基于约定的准则实现，但可基于配置文件进行扩展。

## 安装

NPM:
```shell
$ npm i --save @rockerjs/mvc
```

## 使用

```typescript
import { Logger } from "@rockerjs/common";
import { Application, AbstractApplication } from "@rockerjs/mvc";

@Application
class App extends AbstractApplication {
  public async beforeServerStart(server, args: RockerConfig.Application) {
    Logger.info('beforeServerStart hook ' + args.name + args.uploadDir);
  }
  public static async main(args: RockerConfig.Application) {
    Logger.info('main bussiness '  + args.name + args.uploadDir);
  }
}
```

## 文档

[Rockerjs-MVC使用教程](https://rockerjs.weidian.com/compass/mvc.html)

## Contribute

请参考 [Contribute Guide](https://github.com/weidian-inc/rockerjs-mvc/blob/master/CONTRIBUTING.md) 后提交 Pull Request。

## License

MIT
