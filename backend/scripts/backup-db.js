import { runBackup } from "../src/backup.js";

const result = await runBackup();
console.log("respaldo escrito", result.file, `${result.bytes} bytes`);
