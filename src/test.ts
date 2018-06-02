import { XamlFile } from "./xaml/xaml-file";

function test() {
    const f:XamlFile = new XamlFile("","");
    
    f.compileContent(`<atom:AtomPage xmlns:atom="http://web-atoms.com/xaml" xmlns="clr-namespace:Xamarin.Forms">
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

test();