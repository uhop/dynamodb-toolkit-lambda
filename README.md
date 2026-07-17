# dynamodb-toolkit-lambda [![NPM version][npm-img]][npm-url]

[npm-img]: https://img.shields.io/npm/v/dynamodb-toolkit-lambda.svg
[npm-url]: https://npmjs.org/package/dynamodb-toolkit-lambda

> **Superseded.** The Lambda adapter now ships inside [`dynamodb-toolkit`](https://github.com/uhop/dynamodb-toolkit) as the **`dynamodb-toolkit/lambda`** subpath export (3.8.0+). This package is a **frozen re-export thunk**: it keeps existing consumers working unchanged and receives no further development. The repository is archived.

## Migration

Change the imports — nothing else:

```diff
-import {createLambdaAdapter} from 'dynamodb-toolkit-lambda';
+import {createLambdaAdapter} from 'dynamodb-toolkit/lambda';

-import {createNodeListener, createFetchBridge} from 'dynamodb-toolkit-lambda/local.js';
+import {createNodeListener, createFetchBridge} from 'dynamodb-toolkit/lambda/local.js';
```

Then drop `dynamodb-toolkit-lambda` from your `package.json`. The API, options, event-shape auto-detection (API Gateway v1 / v2, Function URL, ALB), and wire contract are identical — the code simply lives in the core package now.

## What this thunk is

`export * from 'dynamodb-toolkit/lambda'` (plus path-compat re-exports for `local.js` and `read-lambda-body.js`) — nothing else. It declares an open-ended peer on `dynamodb-toolkit >= 3.8.0`, so future core releases never require a thunk update.

Documentation lives in the core wiki: [Framework adapters](https://github.com/uhop/dynamodb-toolkit/wiki/Framework-adapters) (shared surface) and [Lambda adapter](https://github.com/uhop/dynamodb-toolkit/wiki/Lambda-adapter).

## Release notes

- 0.4.0 _Frozen re-export thunk over `dynamodb-toolkit/lambda`; superseded by the core subpath. No API changes._
- 0.3.0 _Standalone adapter line (final implementation release); see the core wiki for current docs._

Full details in the wiki's [Release notes](https://github.com/uhop/dynamodb-toolkit-lambda/wiki/Release-notes).

## License

[BSD-3-Clause](LICENSE).
