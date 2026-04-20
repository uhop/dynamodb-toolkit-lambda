// dynamodb-toolkit Lambda adapter — main entry.
// Translates AWS Lambda event shapes into rest-core parsers + matchRoute + standard route pack.
//
// Design outline (to implement):
//   createLambdaAdapter(adapter, options?) → Lambda Handler
//     - detect payload format (v1 / v2 / ALB) from the event shape
//     - extract method + path + query + body (body may be base64-encoded on v1/ALB)
//     - drive rest-core parsers on the query, readJson on the body
//     - dispatch to the supplied dynamodb-toolkit Adapter
//     - build the matching result envelope (APIGatewayProxyResult / APIGatewayProxyStructuredResultV2 / ALBResult)
//
// Reference: dynamodb-toolkit-fetch@0.1.0 src/index.js — structurally parallel,
// same matchRoute / rest-core plumbing, different I/O shim. Lambda differs from
// Fetch in four important ways: event is an envelope object (not a Request),
// body is a string (possibly base64-encoded), response is a plain object
// (not a Response), and there are four distinct event/result shapes whose
// detection happens at call time.
