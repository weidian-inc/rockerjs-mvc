'use strict';
// import { Mysql } from "@rockerjs/mysql-starter";
import { Mysql } from "../../component/db"
let { Column, DOBase, Mapping, Transaction } = Mysql.Module;
import * as moment from 'moment';

export class AppInfo {
    @Column
    public id;

    @Column
    public appid;

    @Column
    public secrete;

    @Column
    public username;

    @Column
    public appname;

    @Column('gmt_create')
    public createTime(createTime) {
        try {
            return moment(createTime).format('YYYY-MM-DD HH:mm:ss')
        } catch (e) {
            return createTime;
        }
    }
}