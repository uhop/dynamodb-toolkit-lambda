// JSON body reader for AWS Lambda event bodies.
//
// Lambda delivers request bodies as already-buffered strings — optionally
// base64-encoded when the payload is binary or the trigger is configured for
// base64-on-binary (ALB / API Gateway with binary-media-types). There is no
// stream to guard, so the shape is much simpler than the Fetch adapter's
// `readJsonBody` — one byte-length check then a JSON.parse.
//
// Errors are shaped to match the fetch / node:http adapters:
//   - Oversize → `status: 413`, `code: 'PayloadTooLarge'`.
//   - Invalid JSON → `status: 400`, `code: 'BadJsonBody'`.

import {Buffer} from 'node:buffer';

export const readJsonBody = (body, isBase64Encoded, maxBodyBytes) => {
  if (body == null || body === '') return null;

  let text;
  if (isBase64Encoded) {
    const bytes = Buffer.from(body, 'base64');
    if (bytes.length > maxBodyBytes) {
      throw Object.assign(new Error(`Request body exceeds ${maxBodyBytes} bytes`), {status: 413, code: 'PayloadTooLarge'});
    }
    text = bytes.toString('utf-8');
  } else {
    const byteLength = Buffer.byteLength(body, 'utf-8');
    if (byteLength > maxBodyBytes) {
      throw Object.assign(new Error(`Request body exceeds ${maxBodyBytes} bytes`), {status: 413, code: 'PayloadTooLarge'});
    }
    text = body;
  }

  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    throw Object.assign(err, {status: 400, code: 'BadJsonBody'});
  }
};
