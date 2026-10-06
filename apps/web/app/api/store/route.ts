import { makeProxy } from "@/lib/proxy";

export const GET = makeProxy("/api/store", "GET");
