import {describe,expect,it,vi} from "vitest";
import {createApiClient} from "../src/api/index.js";

/** @param {unknown} data Response payload. @param {number} [status] Status code. */
function response(data, status = 200) {
  return new Response(JSON.stringify(data), {status,headers:{"Content-Type":"application/json"}});
}

describe("API CSRF identity", () => {
  it("keeps anonymous and Bearer requests in separate caches", async () => {
    // Arrange
    const fetchMock=vi.fn(async (url, request) => String(url).endsWith("csrf-token")
      ? response({token:request.headers.get("Authorization") ?? "anonymous"}) : response({}));
    const client=createApiClient({baseUrl:"http://localhost:7000",fetchImplementation:fetchMock,accessTokenProvider:()=>"member"});
    // Act
    const modes = /** @type {const} */ (["none","required","optional","none"]);
    for(const authentication of modes) {
      await client.request("/test",{method:"POST",csrf:true,authentication});
    }
    // Assert
    const loads=fetchMock.mock.calls.filter(([url])=>String(url).endsWith("csrf-token"));
    expect(loads).toHaveLength(2);
    expect(loads.map(([,r])=>r.headers.get("Authorization"))).toEqual([null,"Bearer member"]);
    const mutations=fetchMock.mock.calls.filter(([url])=>!String(url).endsWith("csrf-token"));
    expect(mutations.map(([,r])=>r.headers.get("X-CSRF-TOKEN"))).toEqual(["anonymous","Bearer member","Bearer member","anonymous"]);
  });

  it("does not dispatch an old identity after its CSRF load completes", async () => {
    // Arrange
    let bearer="first";
    /** @type {(value: Response) => void} */
    let finish=()=>{ throw new Error("Deferred not initialized"); };
    const deferred=new Promise(resolve=>{finish=resolve;});
    const fetchMock=vi.fn().mockReturnValueOnce(deferred).mockImplementation(async (url,request)=>
      response(String(url).endsWith("csrf-token") ? {token:request.headers.get("Authorization")} : {}));
    const client=createApiClient({baseUrl:"http://localhost:7000",fetchImplementation:fetchMock,accessTokenProvider:()=>bearer});
    // Act
    const old=client.request("/test",{method:"POST",csrf:true,authentication:"required"});
    const rejected=expect(old).rejects.toMatchObject({name:"AbortError"});
    bearer="second";
    await client.request("/test",{method:"POST",csrf:true,authentication:"required"});
    finish(response({token:"obsolete"}));
    // Assert
    await rejected;
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][1].headers.get("X-CSRF-TOKEN")).toBe("Bearer second");
  });

  it("invalidates the authenticated cache with the session", async () => {
    // Arrange
    const fetchMock=vi.fn(async url=>response(String(url).endsWith("csrf-token") ? {token:"fresh"} : {}));
    const client=createApiClient({baseUrl:"http://localhost:7000",fetchImplementation:fetchMock,accessTokenProvider:()=>"member"});
    // Act
    await client.request("/test",{csrf:true,authentication:"required"});
    client.invalidateCsrfToken();
    await client.request("/test",{csrf:true,authentication:"required"});
    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not replay an unstructured 400", async () => {
    // Arrange
    const fetchMock=vi.fn().mockResolvedValueOnce(response({token:"csrf"})).mockResolvedValueOnce(response({title:"Unknown failure"},400));
    const client=createApiClient({baseUrl:"http://localhost:7000",fetchImplementation:fetchMock});
    // Act
    const pending=client.request("/test",{method:"POST",csrf:true});
    // Assert
    await expect(pending).rejects.toMatchObject({statusCode:400});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([false,true])("only reports CSRF-load 401 for the current credential revision (changed=%s)", async changed => {
    // Arrange
    let version=1;
    const onUnauthorized=vi.fn();
    const fetchMock=vi.fn(async () => {
      if (changed) version=2;
      return response({statusCode:401,title:null,message:null,errorCode:"SECURITY_UNAUTHORIZED",validationErrors:null},401);
    });
    const client=createApiClient({baseUrl:"http://localhost:7000",fetchImplementation:fetchMock,
      accessTokenProvider:()=>"member",accessTokenVersionProvider:()=>version,onUnauthorized});
    // Act
    const pending=client.request("/test",{csrf:true,authentication:"required"});
    // Assert
    await expect(pending).rejects.toMatchObject({statusCode:401});
    expect(onUnauthorized).toHaveBeenCalledTimes(changed ? 0 : 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never retries a mutation when credentials change after CSRF rejection", async () => {
    // Arrange
    let version=1;
    const fetchMock=vi.fn().mockResolvedValueOnce(response({token:"csrf"})).mockImplementationOnce(async()=>{
      version=2;
      return response({statusCode:400,title:null,message:null,errorCode:"SECURITY_CSRF_VALIDATION_FAILED",validationErrors:null},400);
    });
    const client=createApiClient({baseUrl:"http://localhost:7000",fetchImplementation:fetchMock,
      accessTokenProvider:()=>"member",accessTokenVersionProvider:()=>version});
    // Act
    const pending=client.request("/test",{method:"POST",csrf:true,authentication:"required"});
    // Assert
    await expect(pending).rejects.toMatchObject({name:"AbortError"});
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shares a Bearer CSRF load between concurrent mutations", async () => {
    // Arrange
    const fetchMock=vi.fn(async url=>response(String(url).endsWith("csrf-token") ? {token:"bound"} : {}));
    const client=createApiClient({baseUrl:"http://localhost:7000",fetchImplementation:fetchMock,accessTokenProvider:()=>"member"});
    // Act
    await Promise.all([client.request("/first",{csrf:true,authentication:"required"}),client.request("/second",{csrf:true,authentication:"required"})]);
    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.filter(([url])=>String(url).endsWith("csrf-token"))).toHaveLength(1);
  });
});
