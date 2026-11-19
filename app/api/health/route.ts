import { NextResponse } from "next/server";

export const revalidate = 60;

export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      service: "promec-autocare",
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}
