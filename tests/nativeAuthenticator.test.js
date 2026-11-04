import { expect,it } from "vitest";
import { authenticatorCode } from "../e2e-native/authenticator.js";
it.each([[59,"287082"],[1111111109,"081804"],[1111111111,"050471"],[1234567890,"005924"],[2000000000,"279037"],[20000000000,"353130"]])("uses the backend's RFC 6238 vector at %s",(seconds,code)=>{
 expect(authenticatorCode("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ",seconds)).toBe(code);
});
it("rejects malformed test setup keys",()=>expect(()=>authenticatorCode("!!")).toThrow("Invalid test authenticator key"));
