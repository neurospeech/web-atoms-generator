import { Assert, Category, Test, TestItem } from "web-atoms-core/bin/unit/base-test";
import { ReplaceTilt } from "../core/ReplaceTilt";

@Category("Core Html")
export class ReplaceTiltTest extends TestItem {

    @Test()
    public test(): void {
        const v = ReplaceTilt.replace('"~/src/view-models/PageViewModel"', "src/web/views/PageView");
        Assert.equals('"../../../view-models/PageViewModel"', v);
    }
}
