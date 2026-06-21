// Env that points the scaffolded app at the e2e primitive stack
// (harness/docker-compose.yml), injected into the app's dev server by
// playwright.config.
export const APP_ENV: Record<string, string> = {
  DATABASE_URL: "postgres://postgres:postgres@localhost:5432/app",
  BEYOND_AUTH_URL: "http://localhost:8080",
  BEYOND_AUTH_ADMIN_SECRET: "test-admin-secret",
  BEYOND_KV_URL: "redis://localhost:6379",
  BEYOND_QUEUE_URL: "http://localhost:4566",
  BEYOND_OBJECTS_URL: "http://localhost:9000",
  BEYOND_OBJECTS_ROOT_TOKEN: "local-root-token",
  NODE_ENV: "development",
};
