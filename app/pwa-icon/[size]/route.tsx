import { ImageResponse } from "next/og";

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const px = size === "512" ? 512 : 192;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#4f46e5",
          color: "#ffffff",
          fontSize: px * 0.55,
          fontWeight: 700,
        }}
      >
        N
      </div>
    ),
    { width: px, height: px },
  );
}
