import { NextResponse } from "next/server";

export const runtime = "edge";

export async function GET() {
  try {
    let boardroom = [
      { user: "0x9faC30440D0990d5B421900Ab3c6a60F30A992ba", totalEth: "1.2500" },
      { user: "0x1234567890123456789012345678901234567890", totalEth: "0.5000" },
    ];
    let jackpotEth = "0.0875";

    // Read live values if Cloudflare KV is bound
    // @ts-ignore
    if (typeof PREX_KV !== "undefined") {
      // @ts-ignore
      const kvBoardroom = await PREX_KV.get("boardroom");
      if (kvBoardroom) boardroom = JSON.parse(kvBoardroom);

      // @ts-ignore
      const kvJackpot = await PREX_KV.get("jackpot_pool");
      if (kvJackpot) jackpotEth = kvJackpot;
    }

    return NextResponse.json({
      boardroom,
      jackpotEth,
      timeLeft: "15:00",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
