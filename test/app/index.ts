import * as path from "path";
import * as fs from "fs"
import '../../index'
import { bootstrap } from '../../index'
import { copyFolderRecursiveSync, copyFileSync } from './utils/fs'
import { Application, AbstractApplication } from "../../index";

export const app = async () => {
    copyFolderRecursiveSync(path.resolve(__dirname, '../../../test/app/config'), path.resolve(__dirname))
    copyFolderRecursiveSync(path.resolve(__dirname, '../../../test/app/assets'), path.resolve(__dirname))
    copyFolderRecursiveSync(path.resolve(__dirname, '../../../test/app/templates'), path.resolve(__dirname))
    copyFolderRecursiveSync(path.resolve(__dirname, '../../../test/app/repository/resource'), path.resolve(__dirname, 'repository'))
    copyFileSync(path.resolve(__dirname, '../../../package.json'), path.resolve(__dirname, '../../'))
    copyFileSync(path.resolve(__dirname, '../../../package.json'), path.resolve(__dirname))
    await bootstrap(path.resolve(__dirname));
}


@Application
class App extends AbstractApplication {
    public async beforeServerStart(server, args) {
        console.log('beforeServerStart hook', server, args);
        server.config({
            assets: {
                '/assets': {
                    folder: path.join(__dirname, 'assets'),
                    cache: 'Etag'
                },
            },
            errorProcessor: error => {
                return {
                    status: {
                        code: error.code == undefined ? 1 : error.code,
                        message: error.message
                    }
                };
            }
        });
    }

    public static async main(args: string[]) {
        console.log('main bussiness', args);
    }
}


