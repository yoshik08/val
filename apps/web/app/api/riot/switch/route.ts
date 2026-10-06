import { makeProxy } from "@/lib/proxy";

export const POST = makeProxy("/api/riot/switch", "POST");
