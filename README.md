# dynamodb-toolkit-lambda [![NPM version][npm-img]][npm-url]

[npm-img]: https://img.shields.io/npm/v/dynamodb-toolkit-lambda.svg
[npm-url]: https://npmjs.org/package/dynamodb-toolkit-lambda

AWS Lambda adapter for [`dynamodb-toolkit`](https://github.com/uhop/dynamodb-toolkit) v3. Serves the toolkit's standard REST route pack as a Lambda handler — same wire contract as `dynamodb-toolkit/handler` (the bundled `node:http` adapter), [`dynamodb-toolkit-fetch`](https://github.com/uhop/dynamodb-toolkit-fetch), [`dynamodb-toolkit-koa`](https://github.com/uhop/dynamodb-toolkit-koa), and [`dynamodb-toolkit-express`](https://github.com/uhop/dynamodb-toolkit-express), translated for Lambda's event / result shape.

Supported event sources:

- **API Gateway REST API** (payload format **1.0**).
- **API Gateway HTTP API** (payload format **2.0**).
- **Lambda Function URLs** (payload format **2.0**).
- **Application Load Balancer** (multi-value headers mode and single-value).

Shares the wire contract with the bundled `dynamodb-toolkit/handler` and the `-koa` / `-express` / `-fetch` siblings — same routes, same envelope, same status codes, same option surface. Auto-detects the incoming event shape at call time and returns the matching result envelope.

## Install

```sh
npm install dynamodb-toolkit-lambda dynamodb-toolkit @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
```

`dynamodb-toolkit` is declared as a **peer dependency**. No framework peer dep — AWS Lambda's Node runtime is the target.

## Quick start

### API Gateway HTTP API (payload 2.0) or Lambda Function URL

```js
import {DynamoDBClient} from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient} from '@aws-sdk/lib-dynamodb';
import {Adapter} from 'dynamodb-toolkit';
import {createLambdaAdapter} from 'dynamodb-toolkit-lambda';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({region: process.env.AWS_REGION}));
const planets = new Adapter({client, table: 'planets', keyFields: ['name']});

export const handler = createLambdaAdapter(planets, {mountPath: '/planets'});
```

### API Gateway REST API (payload 1.0)

Same factory — the adapter auto-detects the payload format from the event shape. The result is the event's corresponding `APIGatewayProxyResult` or `APIGatewayProxyStructuredResultV2`.

### ALB

Same factory — if the target group has **Multi value headers** enabled, the adapter mirrors the `multiValueHeaders` response shape automatically by detecting it on the incoming event.

```js
export const handler = createLambdaAdapter(planets, {mountPath: '/planets'});
```

## Local development

AWS's debugging tools for Lambda-behind-HTTP are cumbersome. This package ships a zero-dep bridge so you can drive the **exact** Lambda code path against real HTTP requests on localhost — no framework dep, no deploy cycle.

### `node:http` — standalone dev server

```js
import http from 'node:http';
import {createLambdaAdapter} from 'dynamodb-toolkit-lambda';
import {createNodeListener} from 'dynamodb-toolkit-lambda/local.js';

const handler = createLambdaAdapter(planets, {mountPath: '/planets'});
http.createServer(createNodeListener(handler)).listen(3000);
// curl http://localhost:3000/planets
```

`createNodeListener` synthesizes a full API Gateway event from each incoming HTTP request (v2 by default; pass `{eventShape: 'v1'}` to test v1-specific paths), invokes the handler, and writes the Lambda result envelope back through the HTTP response. Binary request bodies are base64-encoded before reaching the handler, matching AWS's binary-media-types behavior.

### Fetch runtimes (Bun, Deno, Cloudflare Workers)

```js
import {createLambdaAdapter} from 'dynamodb-toolkit-lambda';
import {createFetchBridge} from 'dynamodb-toolkit-lambda/local.js';

const handler = createLambdaAdapter(planets);
Bun.serve({port: 3000, fetch: createFetchBridge(handler)});
```

### Plug into an existing Koa / Express app

This package doesn't depend on Koa or Express. Copy ~10 lines to bridge manually:

```js
// Koa
import Koa from 'koa';
import {createLambdaAdapter} from 'dynamodb-toolkit-lambda';
import {createNodeListener} from 'dynamodb-toolkit-lambda/local.js';

const listener = createNodeListener(createLambdaAdapter(planets));
const app = new Koa();
app.use(ctx => listener(ctx.req, ctx.res).then(() => (ctx.respond = false)));
app.listen(3000);
```

```js
// Express
import express from 'express';
import {createLambdaAdapter} from 'dynamodb-toolkit-lambda';
import {createNodeListener} from 'dynamodb-toolkit-lambda/local.js';

const listener = createNodeListener(createLambdaAdapter(planets));
const app = express();
app.use((req, res) => listener(req, res));
app.listen(3000);
```

For a framework-native story without the bridge — share the same `Adapter` instance between a Lambda deployment and a Koa / Express / Fetch dev entry, using `dynamodb-toolkit-koa` / `-express` / `-fetch` directly.

## Compatibility

- **AWS Lambda, Node 20+ runtime.**
- Payload formats: API Gateway v1 (`APIGatewayProxyEvent`), v2 (`APIGatewayProxyEventV2`), Function URLs (payload 2.0), ALB (`ALBEvent`).
- `peerDependencies`: `dynamodb-toolkit ^3.1.1` only.

## License

[BSD-3-Clause](LICENSE).
