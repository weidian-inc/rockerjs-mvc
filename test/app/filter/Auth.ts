import { Filter, AbstractFilter } from '../../../index';

let pattern = null;

@Filter
export class Auth extends AbstractFilter {


    init(args: string[]) {
        pattern = args[0];
        console.log('auth filter init', args);
    }

    // koa context, this === context
    async doFilter(context, next) {
        await fakeLogin({ // 前置过滤
            ignore: new RegExp(pattern, 'i') // /(uploadProfile)|(\/build\/\d+\/)\S+/i
        })(context, next)
    }

    destroy() {
        console.log('auth filter destroy')
    }
}




type LoginParams = {
    ignore?: RegExp
};
const ckName = 'login-l-u';

let fakeLogin = function login(_opt?: LoginParams) {
    return async function (ctx, _next) {
        let url = ctx.request.url;

        if (_opt && _opt.ignore && _opt.ignore.test(url)) {//ignore service
            return await _next();
        }

        let ckv = ctx.cookies.get(ckName)
        let mkCtxState = function (_user) {
            ctx.state = {
                hostName: ctx.req.headers.host,
                userAgent: ctx.req.headers['user-agent'],
                loginUser: _user,//当前登录用户
                attr: function (_key) {
                    return {
                        'login-user': _user
                    }[_key];
                }
            };//传递参数
        };

        if (ckv) {//had login
            let json = new Buffer(ckv, 'base64').toString();
            mkCtxState(JSON.parse(json));
            return await _next();
        } else {
            ctx.response.redirect("https://example.com");
            return;
        }
    }
}
