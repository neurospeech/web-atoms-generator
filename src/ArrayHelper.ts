export interface IKeyValues<T> {
    key: T;
    values: T[];
}

export class ArrayHelper {

    /**
     * This method groups given array by specified key, it performs
     * best with array with sorted key
     * @param a input array
     * @param keySelector key selector
     */
    public static groupBy<T>(a: T[], keySelector: (item: T) => any): Array<IKeyValues<T>> {
        const r: Array<IKeyValues<T>> = [];
        let lastKey: any;
        let lastKeyStore: IKeyValues<T>;
        for (const iterator of a) {
            const key = keySelector(iterator);
            // tslint:disable-next-line:triple-equals
            if (key != lastKey) {
                lastKey = key;
                lastKeyStore = r.find((x) => x.key === key);
                if (!lastKeyStore) {
                    lastKeyStore = { key, values: [iterator] };
                    r.push(lastKeyStore);
                    continue;
                }
            }
            lastKeyStore.values.push(iterator);
        }
        return r;
    }
}
