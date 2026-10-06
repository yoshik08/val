import "server-only";
import { NextResponse } from "next/server";
import { apiFetch, ApiError } from "@/lib/api";

type Method = "GET" | "POST" | "DELETE";

export function makeProxy(path: string, method: Method) {
  return async (req: Request) => {
    let body: unknown;
    if (method !== "GET") {
      try {
        body = await req.json();
      } catch {
        body = undefined;
      }
    }
    try {
      const data = await apiFetch(path, { method, json: body });
      return NextResponse.json(data);
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json(
          { error: e.message, code: e.code },
          { status: e.status === 0 ? 503 : e.status }
        );
      }
      return NextResponse.json(
        { error: "unexpected error" },
        { status: 500 }
      );
    }
  };
}
