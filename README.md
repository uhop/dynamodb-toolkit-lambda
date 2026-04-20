# dynamodb-toolkit-lambda [![NPM version][npm-img]][npm-url]

[npm-img]: https://img.shields.io/npm/v/dynamodb-toolkit-lambda.svg
[npm-url]: https://npmjs.org/package/dynamodb-toolkit-lambda

AWS Lambda adapter for [`dynamodb-toolkit`](https://github.com/uhop/dynamodb-toolkit) v3. Serves the toolkit's standard REST route pack as a Lambda handler — same wire contract as `dynamodb-toolkit/handler` (the bundled `node:http` adapter), [`dynamodb-toolkit-fetch`](https://github.com/uhop/dynamodb-toolkit-fetch), [`dynamodb-toolkit-koa`](https://github.com/uhop/dynamodb-toolkit-koa), and [`dynamodb-toolkit-express`](https://github.com/uhop/dynamodb-toolkit-express), translated for Lambda's event / result shape.

Supported event sources:

- **API Gateway REST API** (payload format **1.0**).
- **API Gateway HTTP API** (payload format **2.0**).
- **Lambda Function URLs** (payload format **2.0**).
- **Application Load Balancer** (multi-value headers mode and single-value).

> **Status: scaffolding.** Implementation to follow. Sibling packages `dynamodb-toolkit-fetch@0.1.0`, `dynamodb-toolkit-koa@0.1.0`, and `dynamodb-toolkit-express@0.1.0` are the structural reference.

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

```js
export const handler = createLambdaAdapter(planets, {
  mountPath: '/planets',
  multiValueHeaders: true // required for ALB targets with "Multi value headers" enabled
});
```

## Compatibility

- **AWS Lambda, Node 20+ runtime.**
- Payload formats: API Gateway v1 (`APIGatewayProxyEvent`), v2 (`APIGatewayProxyEventV2`), Function URLs (payload 2.0), ALB (`ALBEvent`).
- `peerDependencies`: `dynamodb-toolkit ^3.1.1` only.

## License

[BSD-3-Clause](LICENSE).
