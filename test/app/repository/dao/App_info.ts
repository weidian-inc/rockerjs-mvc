'use strict';

import { Mysql } from "../../component/db";
const { DOBase, Mapping } = Mysql.Module; // 使用 typeof 强转类型
import { AppInfo } from "../dto/App_info";

export class AppInfoDao extends DOBase {
    public async add({appid,secrete,username,appname}) {
        const fId = await this.exe('appInfo:add',{
            appid,secrete,username,appname
        });
        return fId;
    }

    @Mapping(AppInfo)
    public async queryAll() {
        const ary = await this.exe('appInfo:queryAll', {});
        return ary;
    }

    @Mapping(AppInfo)
    public async queryByName(name) {
        const ary = await this.exe('appInfo:queryByName', {name});
        return ary;
    }

    @Mapping(AppInfo)
    public async queryByNameAndAppname(name,appname) {
        const ary = await this.exe('appInfo:queryByNameAndAppname', {
            username: name,
            appname
        });
        return ary;
    }

    public async del(appid) {
        let ret,isErr = false;
        try{
            ret = await this.exe('appInfo:del', {
                appid
            });
        }catch(e){
            ret = e;
            isErr = true;
        }

        return {
            err: isErr,
            result: ret
        };
    }

}