// TypeScript declarations for Deno Edge Functions
declare global {
  namespace Deno {
    namespace env {
      function get(key: string): string | undefined;
    }
  }
}

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(handler: (req: Request) => Promise<Response>): void;
}

export {};
