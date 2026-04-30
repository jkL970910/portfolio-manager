import { BackendRepositories } from "@/lib/backend/repositories/interfaces";
import { mockRepositories } from "@/lib/backend/repositories/mock-repositories";
import { postgresRepositories } from "@/lib/backend/repositories/postgres-repositories";

export type RepositoryMode = "mock" | "postgres-drizzle";

export function getRepositoryMode(): RepositoryMode {
  return (process.env.REPOSITORY_MODE ?? "mock") as RepositoryMode;
}

export function getRepositories(): BackendRepositories {
  switch (getRepositoryMode()) {
    case "mock":
      return mockRepositories;
    case "postgres-drizzle":
      return postgresRepositories;
    default:
      return mockRepositories;
  }
}
