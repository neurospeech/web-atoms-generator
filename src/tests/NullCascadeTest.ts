import { Assert, Category, Test, TestItem } from "web-atoms-core/bin/unit/base-test";
import { HtmlContent } from "../core/HtmlContent";

@Category("Null Cascade")
export class TestCase extends TestItem {

    @Test("")
    public test(): void {
        const s = HtmlContent.processOneTimeBinding("{ $viewModel.item.data.x }");
        Assert.equals(
            "((((this.viewModel) ? this.viewModel.item : undefined) ?" +
            " this.viewModel.item.data : undefined) ? this.viewModel.item.data.x : undefined)",
            s);
    }

}
