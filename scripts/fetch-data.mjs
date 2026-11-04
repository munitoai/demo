import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";

const directory = new URL("../data/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("sources.json", directory), "utf8"));
await mkdir(directory, { recursive: true });

for (const document of manifest.documents) {
  const response = await fetch(document.url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`${document.file}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const pdf = document.file.endsWith(".pdf");
  const signature = pdf ? Buffer.from("%PDF-") : Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!bytes.subarray(0, signature.length).equals(signature)) {
    throw new Error(`${document.file}: unexpected file format`);
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (document.sha256 && document.sha256 !== sha256) {
    throw new Error(`${document.file}: checksum differs from sources.json`);
  }
  const temporary = new URL(`${document.file}.part`, directory);
  await writeFile(temporary, bytes);
  await rename(temporary, new URL(document.file, directory));
  console.log(`${document.file}: ${bytes.length} bytes, SHA-256 ${sha256}`);
}
