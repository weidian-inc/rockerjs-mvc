// middleware starter
import * as db from "@rockerjs/dao";
import { Component, AbstractComponent } from '../../../index'

@Component
export class Mysql extends AbstractComponent {
    static Module: typeof db;
    public name: string;
    constructor() {
        super();
        this.name = 'mysql'
    }

    // 注入配置信息
    // 初始化
    async start(config) {
        db.start([{
            host: config.host,
            user: config.user,
            password: config.password,
            port: config.port,
            database: config.database,
            sqlPath: config.resourcePath
        }]);

        Mysql.Module = db;
        return db;
    }
}
