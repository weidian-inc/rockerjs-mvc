export function isEmpty(v: any): boolean {
    return typeof v === "undefined" || v == null;
}

export function isPromise(obj): boolean {
    if (obj && typeof obj.then === "function" && typeof obj.catch === "function") {
        return true;
    } else {
        return false;
    }
}

export function isFunction(fn): boolean {
    return !isEmpty(fn) && Object.prototype.toString.call(fn) === "[object Function]";
}

export function isGenerator(obj) {
    return "function" === typeof obj.next && "function" === typeof obj.throw;
}

export function isGeneratorFunction(obj) {
    const constructor = obj.constructor;
    if (!constructor) {
        return false;
    }
    if ("GeneratorFunction" === constructor.name || "GeneratorFunction" === constructor.displayName) {
        return true;
    }
    return isGenerator(constructor.prototype);
}

export function getLocalIp() {
    const os = require("os");
    let localIp = "127.0.0.1";
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const devInterface = interfaces[devName];
        for (let i = 0; i < devInterface.length; i++) {
            const iface = devInterface[i];
            if (iface.family === "IPv4" && !iface.internal && iface.address !== localIp && iface.address.indexOf(":") < 0) {
                localIp = iface.address;
                return localIp;
            }
        }
    }
    return localIp;
}
