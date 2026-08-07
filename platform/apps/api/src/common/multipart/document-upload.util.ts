import { ALLOWED_DOCUMENT_MIME_TYPES } from "@r2m/contracts";
import { ConflictError, ErrorCode } from "@r2m/domain";

export interface MultipartDocumentUpload {
  documentType: string;
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}

/** Shared by every endpoint that accepts a verification document as `multipart/form-data`
 * (org verification resubmit/attach, org registration) — validates presence and MIME type
 * before any S3/DB write is attempted. */
export function toDocumentUpload(
  file: Express.Multer.File | undefined,
  documentType: string,
): MultipartDocumentUpload {
  if (!file) {
    throw new ConflictError(
      ErrorCode.VERIFICATION_MISSING_DOCUMENT,
      "A verification document file (field \"file\") is required.",
    );
  }
  if (!(ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.mimetype)) {
    throw new ConflictError(
      ErrorCode.VERIFICATION_MISSING_DOCUMENT,
      "Unsupported file type — only PDF/JPG/PNG are accepted.",
    );
  }
  return {
    documentType,
    buffer: file.buffer,
    originalFilename: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
  };
}
