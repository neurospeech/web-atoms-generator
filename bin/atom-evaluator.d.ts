export interface CompiledMethod {
    length?: number;
    method?: Function;
    path?: string[][];
    original?: string;
}
export declare class AtomEvaluator {
    static instance: AtomEvaluator;
    ecache: any;
    becache: any;
    parse(txt: string): CompiledMethod;
    compile(vars: string[], method: string): Function;
}
