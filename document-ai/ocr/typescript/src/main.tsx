import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { createRootRoute, createRoute, createRouter, Link, Outlet, RouterProvider } from "@tanstack/react-router";
import "./style.css";

function Layout() {
  return (
    <main>
      <header>
        <Link to="/" className="wordmark">
          demo<span aria-hidden="true">.</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/" activeOptions={{ exact: true }}>
            Home
          </Link>
          <Link to="/about">About</Link>
        </nav>
      </header>
      <Outlet />
      <footer>A small place to start.</footer>
    </main>
  );
}

function Home() {
  const [count, setCount] = useState(0);

  return (
    <section>
      <p className="eyebrow">HELLO, WORLD</p>
      <h1>Start small.</h1>
      <p>A simple app. One button. A little room to build.</p>
      <div className="counter">
        <output aria-live="polite" aria-label="Count">
          {count}
        </output>
        <div className="actions">
          <button type="button" onClick={() => setCount((value) => value + 1)}>
            Add one <span aria-hidden="true">+</span>
          </button>
          <button type="button" className="secondary" onClick={() => setCount(0)} disabled={count === 0}>
            Reset
          </button>
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section>
      <p className="eyebrow">THE BASICS</p>
      <h1>Just a demo.</h1>
      <p>Use the counter on the home page to try the app.</p>
      <Link to="/" className="text-link">
        Back to home <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}

const rootRoute = createRootRoute({
  component: Layout,
  notFoundComponent: () => (
    <section>
      <h1>Page not found.</h1>
      <Link to="/">Return home</Link>
    </section>
  ),
});
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: Home });
const aboutRoute = createRoute({ getParentRoute: () => rootRoute, path: "/about", component: About });
const router = createRouter({ routeTree: rootRoute.addChildren([homeRoute, aboutRoute]) });

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
