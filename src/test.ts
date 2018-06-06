import { TestRunner } from "web-atoms-core/bin/unit/base-test";

import "./xaml/xaml-file-test";
import "./core/core-html-file-test";

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
