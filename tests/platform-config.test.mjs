import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("exposes a valid installable web app manifest", async () => {
  const manifest = JSON.parse(await read("public/manifest.webmanifest"));

  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "/");
  assert.equal(manifest.icons.length, 2);
  assert.deepEqual(manifest.icons.map((icon) => icon.sizes), ["192x192", "512x512"]);
});

test("registers offline support and native packaging", async () => {
  const [page, serviceWorker, capacitor, desktop, workflow] = await Promise.all([
    read("app/page.tsx"),
    read("public/sw.js"),
    read("capacitor.config.ts"),
    read("desktop/main.mjs"),
    read(".github/workflows/build-apps.yml"),
  ]);

  assert.match(page, /serviceWorker\.register\("\/sw\.js"\)/);
  assert.doesNotMatch(page, /Instalar aplicativo/);
  assert.match(serviceWorker, /certificados-segex-v2/);
  assert.match(capacitor, /br\.mil\.eb\.certificados/);
  assert.match(capacitor, /app-certificados-segex\.giovannifeliciano070\.chatgpt\.site/);
  assert.match(desktop, /contextIsolation: true/);
  assert.match(desktop, /sandbox: true/);
  assert.match(workflow, /Gerador-Certificados-Windows/);
  assert.match(workflow, /Gerador-Certificados-Android/);
});

test("supports unlimited lists and measures the minimum throughput requirement", async () => {
  const page = await read("app/page.tsx");

  assert.doesNotMatch(page, /\.slice\(0, 15\)/);
  assert.match(page, /sem limite fixo/);
  assert.match(page, /performance\.now\(\)/);
  assert.match(page, /rate >= 15/);
  assert.match(page, /cert\.\/s/);
  assert.doesNotMatch(page, /Testar com 15 participantes/);
  assert.doesNotMatch(page, /Restaurar campos/);
  assert.match(page, /Nº REGISTRO/);
  assert.match(page, /categoria CAT/);
  assert.match(page, /data\.validity/);
  assert.match(page, /SignaturePad/);
  assert.match(page, /Importar assinatura/);
  assert.match(page, /signatureImage/);
  assert.doesNotMatch(page, /validation-seal/);
  assert.match(page, /parseParticipantLine/);
});

test("imports participant data from common structured file formats", async () => {
  const [page, packageJson] = await Promise.all([
    read("app/page.tsx"),
    read("package.json"),
  ]);

  assert.match(page, /\.xlsx,\.xls,\.csv,\.txt,\.tsv,\.json/);
  assert.match(page, /XLSX\.read/);
  assert.match(page, /rowsToParticipants/);
  assert.match(page, /recordsToParticipants/);
  assert.match(page, /headerRowIndex/);
  assert.match(page, /recognizedColumns >= 2/);
  assert.match(page, /registro da cnh/);
  assert.match(page, /categoria da cnh/);
  assert.match(page, /Importar arquivo/);
  assert.match(packageJson, /"xlsx"/);
});
