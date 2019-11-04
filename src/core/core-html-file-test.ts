import Category from "@web-atoms/unit-test/dist/Category";
import Test from "@web-atoms/unit-test/dist/Test";
import TestItem from "@web-atoms/unit-test/dist/TestItem";
import { CoreHtmlFile } from "./CoreHtmlFile";

@Category("Core Html")
export class TestCase extends TestItem {

    @Test
    public test(): void {
        const chf = new CoreHtmlFile("stripe-control", {
            imports: {
                atom: "web-atoms-core/bin/controls/"
            }
        });

        chf.compileContent(`
        <AtomListBox.div>

            <span atom-text="Text"></span>

            <span atom-text="{\` \${$viewModel.firstName} \${$viewModel.lastName} \`}"></span>

            <AtomItemsControl.div items="[$viewModel.items]">
                <div presenter="itemsPresenter">
                    <span template="itemTemplate" text="a">
                    </span>
                </div>
            </AtomItemsControl.div>
        </AtomListBox.div>
        `);

        // tslint:disable-next-line:no-console
        // console.log(chf.nodes[0].generated);
    }
}
