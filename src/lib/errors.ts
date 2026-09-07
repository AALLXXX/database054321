export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = "error",
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, code = "bad_request") => new AppError(400, msg, code);
export const unauthorized = (msg = "Harus login terlebih dahulu", code = "unauthorized") =>
  new AppError(401, msg, code);
export const forbidden = (msg = "Tidak punya izin untuk aksi ini", code = "forbidden") =>
  new AppError(403, msg, code);
export const notFound = (msg = "Data tidak ditemukan", code = "not_found") => new AppError(404, msg, code);
export const conflict = (msg: string, code = "conflict") => new AppError(409, msg, code);
export const tooMany = (msg = "Terlalu banyak permintaan, coba lagi nanti", code = "rate_limited") =>
  new AppError(429, msg, code);
