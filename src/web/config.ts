import { RouteCfgAssets } from "./type";

export let Start = new (class {
    private _importPath: string;
    set importPath(_importPath: string) {
        this._importPath = _importPath;
    }

    get importPath(): string {
        return this._importPath;
    }

    private _port: number = 8080;
    set port(_port: number) {
        this._port = _port;
    }

    get port(): number {
        return this._port;
    }
});

export let Router = new (class {
    private _assets: RouteCfgAssets;

    set assets(_assets: RouteCfgAssets) {
        this._assets = _assets;
    }

    get assets(): RouteCfgAssets {
        return this._assets;
    }

    private _threshold = 2048;

    set gZipThreshold(_threshold: number) {
        this._threshold = _threshold;
    }

    get gZipThreshold(): number {
        return this._threshold;
    }

    private _errorProcessor: Function;

    set errorProcessor(errorProcessor: Function) {
        this._errorProcessor = errorProcessor;
    }

    get errorProcessor(): Function {
        return this._errorProcessor;
    }
});
