import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请上传文件" }, { status: 400 });
  }

  if (!file.name.endsWith(".txt")) {
    return NextResponse.json(
      { error: "MVP 本地解析仅支持 txt；docx/pdf 建议先复制文本，后续可接入 Coze 文件能力。" },
      { status: 400 }
    );
  }

  const text = await file.text();
  return NextResponse.json({ fileName: file.name, text });
}
