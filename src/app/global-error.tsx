"use client";

import { useEffect } from "react";

/**
 * Catches throws in the root layout itself (Header/Footer), where the normal
 * error boundary can't render. Must ship its own <html>/<body> and inline
 * styles — globals.css may be the thing that failed.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#e9e4d3",
          color: "#23242f",
          fontFamily: "monospace",
        }}
      >
        <div
          style={{
            maxWidth: 480,
            margin: 16,
            padding: 32,
            border: "3px solid #23242f",
            background: "#fcfaf0",
            boxShadow: "6px 6px 0 #23242f",
            textAlign: "center",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: "#b3261e" }}>
            Something went wrong
          </p>
          <h1 style={{ margin: "16px 0 0", fontSize: 22 }}>The page hit an unexpected error.</h1>
          <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.5 }}>
            Your local files remain in your browser. Try again, or reload the site.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "10px 20px",
              border: "3px solid #23242f",
              background: "#5b54e8",
              color: "#fff",
              fontFamily: "inherit",
              fontSize: 13,
              letterSpacing: 1,
              textTransform: "uppercase",
              cursor: "pointer",
              boxShadow: "3px 3px 0 #23242f",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}