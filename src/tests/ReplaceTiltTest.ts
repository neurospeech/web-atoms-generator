import Assert from "@web-atoms/unit-test/dist/Assert";
import Category from "@web-atoms/unit-test/dist/Category";
import Test from "@web-atoms/unit-test/dist/Test";
import TestItem from "@web-atoms/unit-test/dist/TestItem";
import { ReplaceTilt } from "../core/ReplaceTilt";

@Category("Core Html")
export class ReplaceTiltTest extends TestItem {

    @Test
    public test(): void {
        const v = ReplaceTilt.replace('"~/src/view-models/PageViewModel"', "src/web/views/PageView");
        Assert.equals('"../../../view-models/PageViewModel"', v);
    }
}
