import { Assert } from "web-atoms-core/dist/unit/Assert";
import { Category } from "web-atoms-core/dist/unit/Category";
import { Test } from "web-atoms-core/dist/unit/Test";
import { TestItem } from "web-atoms-core/dist/unit/TestItem";
import { ReplaceTilt } from "../core/ReplaceTilt";

@Category("Core Html")
export class ReplaceTiltTest extends TestItem {

    @Test
    public test(): void {
        const v = ReplaceTilt.replace('"~/src/view-models/PageViewModel"', "src/web/views/PageView");
        Assert.equals('"../../../view-models/PageViewModel"', v);
    }
}
