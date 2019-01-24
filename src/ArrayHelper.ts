export interface IKeyValues<K, T> {
    key: K;
    values: T[];
}

export class ArrayHelper {

    /**
     * This method groups given array by specified key, it performs
     * best with array with sorted key
     * @param a input array
     * @param keySelector key selector
     */
    public static groupBy<K, T>(a: T[], keySelector: (item: T) => K): Array<IKeyValues<K, T>> {
        const r: Array<IKeyValues<K, T>> = [];
        let lastKey: any;
        let lastKeyStore: IKeyValues<K, T>;
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
