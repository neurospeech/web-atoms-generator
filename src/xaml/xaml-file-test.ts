import { Category, Test, TestItem } from "web-atoms-core/bin/unit/base-test";
import { XamlFile } from "./xaml-file";

@Category("xaml-file")
export class TestCase extends TestItem {

    @Test()
    public test(): void {
        const f = new XamlFile("", { imports: {} });

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