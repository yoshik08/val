export class RiotError extends Error {
  code: string;
  status: number;
  constructor(message: string, code = "RIOT_ERROR", status = 502) {
    super(message);
    this.name = "RiotError";
    this.code = code;
    this.status = status;
  }
}
