import { StrictMode, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createRootRoute, createRoute, createRouter, Link, Outlet, RouterProvider } from "@tanstack/react-router";
import "./style.css";

/** The OCR models of the public API. See https://docs.munito.ai/document-ai. */
const MODELS = [
  { id: "munito/ocr-auto", label: "Auto — text layer for a text page, an OCR model for a scan" },
  { id: "munito/ocr-fast", label: "Fast — the text layer of a PDF only" },
  { id: "lightonai/lightonocr-3-4b", label: "LightOnOCR — an OCR model for each page, with tables" },
];

type Page = { index: number; markdown: string; error: string | null };
type Usage = { pages_processed: number; pages_failed: number; cost_usd: number; inference_region: string };
type Result = { status?: string; request_id: string; model: string; pages: Page[]; usage: Usage };

/** The bytes of a file as base64, which is what `document.data` takes. */
async function base64(file: File): Promise<string> {
  const text = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
  return text.slice(text.indexOf(",") + 1);
}

/**
 * One OCR request through the local proxy. The proxy adds MUNITO_API_KEY, so the key never reaches this page.
 * A long document answers 202; the proxy forwards the poll as well, so read the result from `/api/ocr/<id>`.
 */
async function read(file: File, model: string, onProgress: (text: string) => void): Promise<Result> {
  const document = { type: "base64", data: await base64(file), filename: file.name };
  const send = { method: "POST", headers: { "Content-Type": "application/json" } };
  let response = await fetch("/api/ocr", { ...send, body: JSON.stringify({ document, model }) });
  let body = (await response.json()) as Result;
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`);

  while (response.status === 202 || body.status === "running") {
    onProgress(`Reading page ${(body as unknown as { completed?: number }).completed ?? 0}…`);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    response = await fetch(`/api/ocr/${body.request_id}`);
    body = (await response.json()) as Result;
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`);
  }
  if ((body.status ?? "completed") !== "completed") throw new Error(`The request ended as ${body.status}.`);
  return body;
}

function Layout() {
  return (
    <main>
      <header>
        <Link to="/" className="wordmark">
          document ai<span aria-hidden="true">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/" activeOptions={{ exact: true }}>
            Reader
          </Link>
          <Link to="/about">How it works</Link>
        </nav>
      </header>
      <Outlet />
      <footer>
        Each page goes to <code>POST /inference/v1/ocr</code>. The key stays in the local dev server.
      </footer>
    </main>
  );
}

function Reader() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState(MODELS[0]!.id);
  const [state, setState] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const busy = state !== "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    setError("");
    setResult(null);
    setState("Sending the document…");
    try {
      setResult(await read(file, model, setState));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setState("");
    }
  }

  return (
    <section>
      <p className="eyebrow">DOCUMENT AI</p>
      <h1>Read a document.</h1>
      <p>
        Pick a PDF or an image. The page sends it to the Munito AI OCR API and shows the Markdown of each page. The
        sample documents are in <code>../data/</code>.
      </p>

      <form className="reader" onSubmit={submit}>
        <label>
          Document
          <input
            ref={input}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.tiff,.docx,.xlsx"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <label>
          Model
          <select value={model} onChange={(event) => setModel(event.target.value)}>
            {MODELS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <div className="actions">
          <button type="submit" disabled={!file || busy}>
            Read the document <span aria-hidden="true">→</span>
          </button>
          <button
            type="button"
            className="secondary"
            disabled={busy || (!file && !result)}
            onClick={() => {
              setFile(null);
              setResult(null);
              setError("");
              if (input.current) input.current.value = "";
            }}
          >
            Clear
          </button>
        </div>
      </form>

      <output aria-live="polite">{state || error}</output>
      {error !== "" && <p className="failure">{error}</p>}

      {result !== null && (
        <div className="result">
          <p className="eyebrow">
            {result.model} · {result.usage.pages_processed} pages · {result.usage.pages_failed} failed ·{" "}
            {result.usage.cost_usd} USD · read in {result.usage.inference_region}
          </p>
          {result.pages.map((page) => (
            <article key={page.index}>
              <h2>Page {page.index}</h2>
              {page.error !== null ? <p className="failure">{page.error}</p> : <pre>{page.markdown}</pre>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function About() {
  return (
    <section>
      <p className="eyebrow">THE BASICS</p>
      <h1>The key stays here.</h1>
      <p>
        A browser page must never hold an API key, because each visitor can read it. So this app sends each request to{" "}
        <code>/api/ocr</code> on its own origin. The Vite dev server proxies that path to{" "}
        <code>https://api.munito.ai/inference/v1/ocr</code> and adds the header{" "}
        <code>Authorization: Bearer $MUNITO_API_KEY</code> from its own environment.
      </p>
      <p>
        Use the same shape in production: keep the key on your server, and give the browser a route that your server
        owns. The <code>curl</code> and Python examples beside this one call the API directly, because they run on your
        machine.
      </p>
      <Link to="/" className="text-link">
        Back to the reader <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

const rootRoute = createRootRoute({
  component: Layout,
  notFoundComponent: () => (
    <section>
      <h1>Page not found.</h1>
      <Link to="/">Return to the reader</Link>
    </section>
  ),
});
const readerRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Reader });
const aboutRoute = createRoute({ getParentRoute: () => rootRoute, path: "/about", component: About });
const router = createRouter({ routeTree: rootRoute.addChildren([readerRoute, aboutRoute]) });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
