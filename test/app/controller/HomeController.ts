import { Inject } from '@rockerjs/core';
import { Controller, Head, Get, Post, Param, Request, Response, RedirectResp } from '../../../index';
import { MainService } from '../service/main';

@Controller("/home")
export class HomeController {
    @Inject
    mainService: MainService;

    @Get({ url: '/user', render: '../templates/user.ejs' })
    async render() {
        return {
            user: 'foo',
            ejs: {
                user: 'foo'
            }
        }
    }

    @Get({ url: '/mysql' })
    @Post({ url: '/mysql' })
    async home(@Param("name") name: string, @Param("person") person: object, @Request req, @Response res) {
        let a = await this.mainService.sendMsgThenquery();
        let b = await this.mainService.queryCache();
        console.log(req, res);
        return {
            tag: 'hello world',
            a,
            b,
            name,
            person
        }
    }

    @Get({ url: '/dontNeedAuth' })
    async dontNeedAuth() {
        return {
            foo: 'bar'
        }
    }

    @Get({ url: '/needAuth' })
    async needAuth(@Param("name") name: string, @Param("person") person: object) {
        return {
            name,
            person
        }
    }


    @Get({ url: '/error' })
    async error(@Param("name") name: string, @Param("person") person: object) {
        throw new Error('test errorprocessor')
    }

    @Head({ url: '/head' })
    async head() {
        return {
            result: "head echo"
        };
    }

    @Get({ url: '/redirect' })
    async redirect() {
        let rp: RedirectResp = new RedirectResp("https://www.weidian.com/");
        rp.code = 301;
        return rp;
    }

}