import { Category, Test, TestItem } from "web-atoms-core/bin/unit/base-test";
import { XamlFile } from "./xaml-file";

@Category("xaml-file")
export class TestCase extends TestItem {

    @Test()
    public test(): void {
        const f = new XamlFile("", { imports: {} });

        f.compileContent(`<Grid xmlns="clr-namespace:Xamarin.Forms">
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
                    Grid.Row="0"
                    Grid.Column="1"
                    Text="@{ \`\${$viewModel.firstName}\` }"
                />

                <ListView ItemsSource="[ $viewModel.items ]">
                    <ListView.ItemTemplate>
                        <DataTemplate>
                            <Label
                                Text="@{$data.label}"
                                />
                        </DataTemplate>
                    </ListView.ItemTemplate>
                </ListView>
            </Grid>`);
    }

}
