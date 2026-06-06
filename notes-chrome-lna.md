# Chrome Local Network Access - Key Findings

## Problem
Site at https://abrwf.com.br trying to fetch http://localhost:9100 (Print Agent)

## Solution from Chrome docs (June 2025)
Mixed content is EXEMPTED if Chrome knows the request goes to local network:

1. Request hostname is a private IP literal (e.g., 192.168.0.1) → exempt
2. Request hostname is a `.local` domain → exempt  
3. `fetch()` call uses option `targetAddressSpace: "local"` → exempt

```js
// Example: Adding targetAddressSpace flags request as local network
fetch("http://localhost:9100/print", {
  targetAddressSpace: "local",
});
```

## Also needed: 
- Print Agent needs to respond to Private Network Access preflight with:
  - `Access-Control-Allow-Private-Network: true` header on OPTIONS response
  
## Chrome 138+ behavior:
- Shows permission prompt asking user to allow local network access
- Once allowed, requests proceed normally
- The `targetAddressSpace: "local"` option exempts from mixed content checks

## Key: use `http://127.0.0.1:9100` instead of `http://localhost:9100`
- 127.0.0.1 is a private IP literal → automatically exempt from mixed content
- localhost might resolve differently or not be treated as IP literal
