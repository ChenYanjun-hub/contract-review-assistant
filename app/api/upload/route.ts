import { NextResponse } from "next/server";
import mammoth from "mammoth";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function getFileExtension(fileName: string) {
  return fileName.toLowerCase().split(".").pop() || "";
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请上传文件" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "文件过大，请上传 10MB 以内的合同文件。" },
      { status: 400 }
    );
  }

  const extension = getFileExtension(file.name);

  try {
    let text = "";

    if (extension === "txt") {
      text = await file.text();
    } else if (extension === "docx") {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      return NextResponse.json(
        { error: "当前支持上传 .txt 或 .docx 合同文件，请转换格式后重试。" },
        { status: 400 }
      );
    }

    const normalizedText = text.trim();
    if (!normalizedText) {
      return NextResponse.json(
        { error: "未能从文件中识别出可审查的文本内容，请确认文件不是扫描件或图片合同。" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      fileName: file.name,
      fileType: extension,
      text: normalizedText
    });
  } catch (error) {
    console.error("Contract upload parse failed", error);
    return NextResponse.json(
      { error: "文件解析失败，请确认文件未损坏，或复制合同正文后直接粘贴。" },
      { status: 500 }
    );
  }
}
