import { readFileSync,readdirSync } from "node:fs";
import { join,extname } from "node:path";
import { fileURLToPath,pathToFileURL } from "node:url";
import { it,expect } from "vitest";
it("keeps application text loadable as strict UTF-8 by Vite",()=>{
 const directory=fileURLToPath(new URL("../src/",import.meta.url));
 const sources=readdirSync(directory,{recursive:true,withFileTypes:true}).filter(entry=>entry.isFile() && [".js",".css",".svg",".html",".json"].includes(extname(entry.name)));
 for(const entry of sources){const path=join(entry.parentPath,entry.name);expect(()=>new TextDecoder("utf-8",{fatal:true}).decode(Buffer.from(readFileSync(pathToFileURL(path),"latin1"),"latin1")),path).not.toThrow();}
});
