import { Rpc } from "@rockerjs/rpc-starter";
let { Resource } = Rpc.Module;

export default abstract class HttpNpsRequest {
    @Resource({ baseUrl: "http://nps.vdian.net", url: '/api/npis/0.0.1/getUserAppInfo' })
    queryYourAppsInfo(): any {} // need auth, in cookie
}
