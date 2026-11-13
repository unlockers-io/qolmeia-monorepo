import type { TeamEvent } from "@repo/worker-api/contracts";
import { DurableObject } from "cloudflare:workers";

const encoder = new TextEncoder();

class TeamEvents extends DurableObject<Env> {
  readonly #subscribers = new Set<ReadableStreamDefaultController<Uint8Array>>();

  broadcast(event: TeamEvent): void {
    for (const subscriber of this.#subscribers) {
      try {
        subscriber.enqueue(
          encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`),
        );
      } catch {
        this.#subscribers.delete(subscriber);
      }
    }
  }

  subscribe(): Response {
    let subscriber: ReadableStreamDefaultController<Uint8Array> | undefined;

    const stream = new ReadableStream<Uint8Array>({
      cancel: () => {
        if (subscriber !== undefined) {
          this.#subscribers.delete(subscriber);
        }
      },
      start: (controller) => {
        subscriber = controller;
        this.#subscribers.add(controller);
        controller.enqueue(encoder.encode(": connected\n\n"));
      },
    });

    return new Response(stream, {
      headers: { "Cache-Control": "no-cache, no-transform", "Content-Type": "text/event-stream" },
    });
  }
}

export { TeamEvents };
