import { Assert } from "web-atoms-core/dist/unit/Assert";
import { Category } from "web-atoms-core/dist/unit/Category";
import { Test } from "web-atoms-core/dist/unit/Test";
import { TestItem } from "web-atoms-core/dist/unit/TestItem";
import { ArrayHelper } from "../ArrayHelper";

@Category("group-by")
export class TestCase extends TestItem {

    @Test
    public groupBy(): void {
        const g = ArrayHelper.groupBy([
            {
                header: "a",
                value: "a1"
            },
            {
                header: "a",
                value: "a2"
            },
            {
                header: "b",
                value: "b2"
            }
        ], (x) => x.header);

        Assert.isTrue(g.length === 2);
        Assert.isTrue(g[0].values.length === 2);
        Assert.isTrue(g[1].values.length === 1);
    }

}
