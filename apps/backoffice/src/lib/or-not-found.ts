import { ApiError } from "@repo/worker-api";
import { notFound } from "next/navigation";

const NOT_FOUND = 404;

const orNotFound = async <T>(request: Promise<T>): Promise<T> => {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && error.status === NOT_FOUND) {
      notFound();
    }

    throw error;
  }
};

export { orNotFound };
