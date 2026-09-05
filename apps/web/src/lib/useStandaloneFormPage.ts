import { useLayoutEffect } from "react";

function applyStandaloneScrollUnlock() {
  const html = document.documentElement;
  const body = document.body;
  const root = document.getElementById("root");

  html.classList.add("is-standalone-form");
  body.classList.add("is-standalone-form");

  html.style.overflow = "auto";
  html.style.height = "auto";
  html.style.maxHeight = "none";
  body.style.overflow = "visible";
  body.style.height = "auto";
  body.style.maxHeight = "none";
  if (root) {
    root.style.overflow = "visible";
    root.style.height = "auto";
    root.style.maxHeight = "none";
    root.style.display = "block";
  }
}

function clearStandaloneScrollUnlock() {
  const html = document.documentElement;
  const body = document.body;
  const root = document.getElementById("root");

  html.classList.remove("is-standalone-form");
  body.classList.remove("is-standalone-form");

  html.style.overflow = "";
  html.style.height = "";
  html.style.maxHeight = "";
  body.style.overflow = "";
  body.style.height = "";
  body.style.maxHeight = "";
  if (root) {
    root.style.overflow = "";
    root.style.height = "";
    root.style.maxHeight = "";
    root.style.display = "";
  }
}

/** Unlock body scroll for popup / standalone fill windows (checklist, NCR, drawing check). */
export function useStandaloneFormPage() {
  useLayoutEffect(() => {
    applyStandaloneScrollUnlock();
    return clearStandaloneScrollUnlock;
  }, []);
}
