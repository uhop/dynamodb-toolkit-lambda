import type {Adapter} from 'dynamodb-toolkit';
import type {RestPolicy} from 'dynamodb-toolkit/rest-core';
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
  ALBEvent,
  ALBResult,
  Context
} from 'aws-lambda';

/** Any of the event shapes this adapter accepts. */
export type LambdaEvent = APIGatewayProxyEvent | APIGatewayProxyEventV2 | ALBEvent;

/**
 * Union of the result envelopes this adapter emits. Which one is returned
 * depends on the shape of the incoming event:
 *
 * - API Gateway REST v1 → {@link APIGatewayProxyResult}.
 * - API Gateway HTTP v2 / Function URL → {@link APIGatewayProxyStructuredResultV2}.
 * - ALB → {@link ALBResult}.
 *
 * All three share the `{statusCode, body, headers?, multiValueHeaders?}`
 * surface, so the union is pragmatically a single type for most consumers.
 */
export type LambdaResult = APIGatewayProxyResult | APIGatewayProxyStructuredResultV2 | ALBResult;

/** Options for {@link createLambdaAdapter}. */
export interface LambdaAdapterOptions<TItem extends Record<string, unknown> = Record<string, unknown>> {
  /** Partial overrides for the REST policy (merged with the default). */
  policy?: Partial<RestPolicy>;
  /**
   * Map from sort-field name to the GSI index that provides that ordering.
   * `?sort=name` becomes `{index: sortableIndices.name, descending: false}`.
   */
  sortableIndices?: Record<string, string>;
  /**
   * Convert the URL `:key` segment into a key object. Runs on every keyed
   * route (`GET /:key`, `PUT /:key`, `PATCH /:key`, `DELETE /:key`, and the
   * single-item `-clone` / `-move` endpoints).
   *
   * Default: `(raw, adp) => ({[adp.keyFields[0]]: raw})` — the raw string
   * becomes the partition key. Override for composite keys (e.g.
   * `${partition}:${sort}` → `{partition, sort}`), numeric coercion, or
   * URL-format validation.
   *
   * @param rawKey The URL-decoded `:key` path segment, always a string.
   * @param adapter The target Adapter. Inspect `adapter.keyFields` to decide
   *   which fields to populate when writing a generic callback.
   * @returns The full key object. Every entry in `adapter.keyFields` must be
   *   a property of the returned object; the return value flows directly
   *   into `adapter.getByKey` / `put` / `patch` / `delete`.
   */
  keyFromPath?: (rawKey: string, adapter: Adapter<TItem>) => Record<string, unknown>;
  /**
   * Build the `example` object passed to `Adapter.prepareListInput` from the
   * current request. Runs on `GET /`, `DELETE /`, and the `PUT /-clone` /
   * `PUT /-move` bulk endpoints — the collection-level routes that invoke
   * the Adapter's list-params machinery.
   *
   * Default: `() => ({})` — no example; `prepareListInput` derives everything
   * from the `index` argument alone.
   *
   * Receives both the Lambda `event` and the Lambda `context` so tenants can
   * reach anything the runtime exposes (`event.requestContext.identity` /
   * `authorizer` claims on v1, `event.requestContext.authorizer.lambda` on v2,
   * `context.awsRequestId` for correlation, `context.invokedFunctionArn` for
   * multi-env routing). v2 cookies are already flattened into
   * `event.headers.cookie` before this hook is invoked, so reading cookies
   * looks the same regardless of trigger.
   *
   * @param query Parsed URL query-string (first value per key).
   * @param body Parsed request body. `null` on `GET /` and `DELETE /`; the
   *   overlay object on `PUT /-clone` / `PUT /-move`.
   * @param event The full Lambda event — v1, v2, or ALB shape.
   * @param context The Lambda context (request ID, deadline info, invoked ARN).
   * @returns The `example` argument threaded into `Adapter.prepareListInput`.
   *   Typically shapes a `KeyConditionExpression` for a GSI (e.g.
   *   `{tenantId: resolveTenant(event)}` for per-tenant scoping).
   */
  exampleFromContext?: (query: Record<string, string>, body: unknown, event: LambdaEvent, context: Context) => Record<string, unknown>;
  /**
   * Cap for the request body in bytes. Enforced on every body-reading route.
   * The adapter rejects with `413 PayloadTooLarge` when the decoded body
   * exceeds the cap.
   *
   * Lambda already enforces platform-level caps (6 MB sync for API Gateway
   * REST, 1 MB for HTTP v2 + Function URL, varies for ALB). This option is
   * for tenant-level rejection before `JSON.parse` — useful when you want to
   * reject 2 MB JSON on a write endpoint whose real use case maxes out at 64 KB.
   *
   * Default: `1048576` (1 MiB), matching the bundled `node:http` handler and
   * the koa / express / fetch adapters.
   */
  maxBodyBytes?: number;
  /**
   * Path prefix the adapter is mounted under. Stripped from the incoming
   * pathname before route matching.
   *
   * Use when the adapter shares a Lambda with other routes, or when the
   * trigger prepends a segment the adapter shouldn't see (API Gateway stage
   * variable `/prod`, or a hand-rolled multi-resource function). A request
   * whose pathname is neither equal to `mountPath` nor starts with
   * `mountPath + '/'` is treated as a miss (default `404 Not Found`).
   *
   * Leave unset when the Lambda owns every path under its trigger (typical
   * for Function URLs and single-resource deployments).
   */
  mountPath?: string;
}

/**
 * Build a Lambda handler that serves the standard dynamodb-toolkit REST route
 * pack against the supplied Adapter.
 *
 * Routes (all rooted at {@link LambdaAdapterOptions.mountPath}, or at `/` when
 * no mount is set):
 * - `GET/POST/DELETE /` — getAll / post / deleteAllByParams
 * - `GET /-by-names`, `DELETE /-by-names` — getByKeys / deleteByKeys
 * - `PUT /-load` — bulk putAll
 * - `PUT /-clone`, `PUT /-move` — cloneAllByParams / moveAllByParams (body is overlay)
 * - `PUT /-clone-by-names`, `PUT /-move-by-names` — cloneByKeys / moveByKeys
 * - `GET/PUT/PATCH/DELETE /:key` — getByKey / put / patch / delete
 * - `PUT /:key/-clone`, `PUT /:key/-move` — single-item clone / move
 *
 * The returned handler auto-detects the event shape at invocation time:
 * - `event.requestContext.elb` → ALB (emits {@link ALBResult}).
 * - `event.version === '2.0'` → API Gateway HTTP v2 / Function URL (emits
 *   {@link APIGatewayProxyStructuredResultV2}).
 * - otherwise → API Gateway REST v1 (emits {@link APIGatewayProxyResult}).
 *
 * Dispatch behavior:
 * - Unknown route or off-mount request → empty `404`.
 * - Known shape, unsupported method → `405 Method Not Allowed` with a JSON body.
 * - Thrown errors map through `policy.errorBody` + `mapErrorStatus` into a JSON
 *   body plus the matching status code.
 *
 * Response-header mode auto-matches the request: if the event carried
 * `multiValueHeaders`, the response uses `multiValueHeaders` too (ALB multi-value
 * mode, API Gateway v1 with enabled multi-value). Otherwise the response uses
 * single-value `headers`.
 *
 * @param adapter The dynamodb-toolkit Adapter that performs the DynamoDB work.
 * @param options Policy, mount prefix, sortable indices, key / example extractors,
 *   and body cap.
 * @returns A Lambda handler `(event, context) => Promise<result>` that accepts
 *   any of the three event shapes and returns the matching result envelope.
 */
export function createLambdaAdapter<TItem extends Record<string, unknown> = Record<string, unknown>>(
  adapter: Adapter<TItem>,
  options?: LambdaAdapterOptions<TItem>
): (event: LambdaEvent, context: Context) => Promise<LambdaResult>;
