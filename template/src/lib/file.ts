// Client helper: read a File into the base64 payload our upload server fns expect.
export async function fileToUpload(file: File): Promise<{
  filename: string;
  contentType: string;
  dataBase64: string;
}> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return {
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    dataBase64: btoa(binary),
  };
}
