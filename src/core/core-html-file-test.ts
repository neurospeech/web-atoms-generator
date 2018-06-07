import { Category, Test, TestItem } from "web-atoms-core/bin/unit/base-test";
import { CoreHtmlFile } from "./core-html-file";

@Category("Core Html")
export class TestCase extends TestItem {

    @Test()
    public test(): void {
        const chf = new CoreHtmlFile("stripe-control", {
            imports: {
                atom: "web-atoms-core/bin/controls/"
            }
        });

        chf.compileContent(`
        <div>

            <span atom-text="Text"></span>

            <span atom-text="{\` \${$viewModel.firstName} \${$viewModel.lastName} \`}"></span>

            <div atom-type="atom:AtomItemsControl" atom-items="[$viewModel.items]">
                <div atom-template="itemTemplate">
                </div>
            </div>
        </div>
        `);

        // tslint:disable-next-line:no-console
        console.log(chf.nodes[0].generated);
    }
}
