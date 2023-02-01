# How To Create a Registry Adapter

Adapter code provides the ability to store the resulting Innersource Ready Reports (IRR) in any persistent storage (eg, Repo, DB, etc.)

To implement an `Adapter`, simply create a new `<foo>Adapter.js` file in the `src/adapters` folder (this one) and use this template code.

```node
const util = require('util')

exports.execute = async function (context, data) {
    # TODO: Implement the adapter
    ...
    }
```

|Parameter|Description|
|---|---|
|context|Request data|
|data|JSON report data|

To use this adapter, call it from the `index.js` `runComplianceChecks` function.
See the `sampleAdapter` usage for an example.
