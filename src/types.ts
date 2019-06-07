export enum Mode {

    None = "",
    Core = "Core"

}

export interface IWAConfig {

    srcFolder?: string;
    outFile?: string;
    outFolder?: string;
    mode?: Mode;
    imports?: { [name: string]: string };

}
