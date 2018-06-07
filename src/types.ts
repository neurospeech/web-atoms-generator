export enum Mode {

    None = "",
    Core = "Core"

}

export interface IWAConfig {

    srcFolder?: string;
    outFile?: string;
    mode?: Mode;
    namespace?: string;
    emitDeclaration?: boolean;
    imports?: { [name: string]: string };

}
