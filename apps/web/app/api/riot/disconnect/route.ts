import { makeProxy } from "@/lib/proxy";

export const DELETE = makeProxy("/api/riot/disconnect", "DELETE");
