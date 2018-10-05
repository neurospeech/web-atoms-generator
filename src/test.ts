// tslint:disable:ordered-imports no-console
import { TestRunner } from "web-atoms-core/bin/unit/base-test";

// import "./xaml/group-by-test";
// import "./xaml/xaml-file-test";
// import "./core/core-html-file-test";
// import "./tests/ReplaceTiltTest";

import "./tests/NullCascadeTest";

const instance: TestRunner = TestRunner.instance;

// export Atom;
declare var process: any;

instance.run().then(() => {
    console.log("Tests ran successfully.");
    process.exit();
}).catch( (e) => {
    console.error(e);
    process.abort();
});
