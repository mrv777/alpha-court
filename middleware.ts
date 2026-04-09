import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { paymentProxy } from "@x402/next";
import { getX402Server, getRoutesConfig, isX402Enabled } from "./lib/x402";

let _handler: ((req: NextRequest) => Promise<NextResponse<unknown>>) | null =
  null;

function getHandler() {
  if (!_handler) {
    _handler = paymentProxy(getRoutesConfig(), getX402Server());
  }
  return _handler;
}

export async function middleware(request: NextRequest) {
  if (!isX402Enabled()) return NextResponse.next();
  return getHandler()(request);
}

export const config = {
  matcher: ["/api/trial"],
};
