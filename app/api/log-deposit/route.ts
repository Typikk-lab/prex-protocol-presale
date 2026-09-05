import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { txHash, user, amountETH, referrer, timestamp } = body;

    if (!txHash || !user || !amountETH) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const depositRecord = {
      txHash,
      user: user.toLowerCase(),
      amountETH,
      referrer: referrer ? referrer.toLowerCase() : null,
      timestamp: timestamp || Date.now(),
    };

    // Cloudflare KV Binding hook
    // @ts-ignore
    if (typeof PREX_KV !== "undefined") {
      // @ts-ignore
      await PREX_KV.put(`tx:${txHash}`, JSON.stringify(depositRecord));

      // Update Boardroom Leaderboard
      // @ts-ignore
      const currentBoardroomRaw = await PREX_KV.get("boardroom");
      let boardroom = currentBoardroomRaw ? JSON.parse(currentBoardroomRaw) : [];

      const existingIdx = boardroom.findIndex((b: any) => b.user === depositRecord.user);
      if (existingIdx >= 0) {
        boardroom[existingIdx].totalEth = (
          parseFloat(boardroom[existingIdx].totalEth) + parseFloat(amountETH)
        ).toFixed(4);
      } else {
        boardroom.push({ user: depositRecord.user, totalEth: parseFloat(amountETH).toFixed(4) });
      }

      boardroom.sort((a: any, b: any) => parseFloat(b.totalEth) - parseFloat(a.totalEth));

      // @ts-ignore
      await PREX_KV.put("boardroom", JSON.stringify(boardroom.slice(0, 10)));

      // Accumulate Jackpot (5% of each deposit adds to off-chain jackpot display)
      // @ts-ignore
      const currentJackpot = await PREX_KV.get("jackpot_pool");
      const updatedJackpot = (parseFloat(currentJackpot || "0") + parseFloat(amountETH) * 0.05).toFixed(4);
      // @ts-ignore
      await PREX_KV.put("jackpot_pool", updatedJackpot);
    }

    return NextResponse.json({ success: true, record: depositRecord });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
