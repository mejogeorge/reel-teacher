/// <reference types="vite/client" />

/**
 * Module map for convex-test — it loads every Convex function module to build an
 * in-memory backend. Glob is relative to this file (the convex/ directory).
 */
export const modules = import.meta.glob("./**/*.*s");
