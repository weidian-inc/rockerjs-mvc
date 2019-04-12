
import { Inject, Container } from "@rockerjs/core";
import { AppInfoDao } from "../repository/dao/App_info";

export class MainService {
    @Inject
    db: AppInfoDao

    async sendMsgThenquery() {
        let result = await this.db.queryByName('yangli');
        return {
            result
        }
    }

    async queryCache() {
        let ret = 8888
        return ret;
    }
}
