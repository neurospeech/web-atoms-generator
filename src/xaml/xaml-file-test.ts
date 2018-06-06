import { XamlFile } from "./xaml-file";
import { TestItem, Test, Category } from "web-atoms-core/bin/unit/base-test";

@Category("xaml-file")
export class TestCase extends TestItem {

    @Test()
    public test(): void {
        const f:XamlFile = new XamlFile("","");

        f.compileContent(`<atom:AtomPage xmlns:atom="http://web-atoms.org/xaml" xmlns="clr-namespace:Xamarin.Forms">
            <Grid>
                <Grid.RowDefinitions>
                    <RowDefinition/>
                    <RowDefinition/>
                    <RowDefinition/>
                </Grid.RowDefinitions>

                <Grid.ColumnDefinitions>
                    <ColumnDefinition/>
                    <ColumnDefinition/>
                    <ColumnDefinition/>
                </Grid.ColumnDefinitions>

                <Label
                    Grid.Row="1"
                    Grid.Column="1"
                    Text="{ \`\${$viewModel.firstName}\` }"
                />
            </Grid>
        </atom:AtomPage>`);
    }

}