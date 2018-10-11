import { Assert } from "web-atoms-core/dist/unit/Assert";
import { Category } from "web-atoms-core/dist/unit/Category";
import { Test } from "web-atoms-core/dist/unit/Test";
import { TestItem } from "web-atoms-core/dist/unit/TestItem";
import { HtmlContent } from "../core/HtmlContent";

@Category("Null Cascade")
export class TestCase extends TestItem {

    @Test
    public test(): void {
        const s = HtmlContent.processOneTimeBinding("{ $viewModel.item.data.x }");
        Assert.equals(
            "((((this.viewModel) ? this.viewModel.item : undefined) ?" +
            " this.viewModel.item.data : undefined) ? this.viewModel.item.data.x : undefined)",
            s);
    }

}
