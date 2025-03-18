import { useFireproof } from "use-fireproof";
import * as fs from "fs"
const d = fs.readFileSync("TodoDB");
const decoder = new TextDecoder();

console.log(decoder.decode(d));